export const WORKFLOW_SCHEMA_VERSION = 1;
export const WORKFLOW_TRIGGER_TYPES = Object.freeze(['one-shot', 'recurring']);
export const WORKFLOW_STEP_TYPES = Object.freeze([
  'collect',
  'retrieve',
  'analyze',
  'compose',
  'invoke-capability',
  'deliver'
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function plainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

function timestamp(value, field) {
  const parsed = value instanceof Date ? value : new Date(requiredString(value, field));
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${field} must be a valid timestamp`);
  return parsed.toISOString();
}

function freezeJson(value, field) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => freezeJson(item, `${field}[${index}]`)));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeJson(item, `${field}.${key}`)])));
  }
  throw new TypeError(`${field} must be JSON-compatible`);
}

function normalizeScope(value) {
  const scope = plainObject(value, 'workflow.scope');
  return Object.freeze({
    globalUserId: requiredString(scope.globalUserId, 'workflow.scope.globalUserId'),
    projectScope: requiredString(scope.projectScope, 'workflow.scope.projectScope'),
    groupScope: scope.groupScope == null ? null : requiredString(scope.groupScope, 'workflow.scope.groupScope'),
    threadScope: scope.threadScope == null ? null : requiredString(scope.threadScope, 'workflow.scope.threadScope')
  });
}

function normalizeTrigger(value) {
  const trigger = plainObject(value, 'workflow.trigger');
  const type = requiredString(trigger.type, 'workflow.trigger.type');
  if (!WORKFLOW_TRIGGER_TYPES.includes(type)) throw new TypeError(`unsupported workflow trigger type: ${type}`);
  return freezeJson({ ...trigger, type }, 'workflow.trigger');
}

export function assertSupportedWorkflowStepType(stepType, field = 'workflow step type') {
  const type = requiredString(stepType, field);
  if (!WORKFLOW_STEP_TYPES.includes(type)) throw new TypeError(`unsupported workflow step type: ${type}`);
  return type;
}

function normalizeWorkflowStep(value, field) {
  const step = plainObject(value, field);
  const type = assertSupportedWorkflowStepType(step.type, `${field}.type`);
  return freezeJson({ ...step, type }, field);
}

export function createWorkflowStep(input) {
  return normalizeWorkflowStep(input, 'workflow step');
}

function normalizeSteps(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('workflow.steps must be a non-empty array');
  return Object.freeze(value.map((step, index) => normalizeWorkflowStep(step, `workflow.steps[${index}]`)));
}

export function assertSupportedWorkflowSchema(schemaVersion) {
  const version = positiveInteger(schemaVersion, 'workflow.schemaVersion');
  if (version !== WORKFLOW_SCHEMA_VERSION) throw new TypeError(`unsupported workflow schema version: ${version}`);
  return version;
}

export function createWorkflowDefinition(input) {
  const workflow = plainObject(input, 'workflow');
  const schemaVersion = assertSupportedWorkflowSchema(workflow.schemaVersion ?? WORKFLOW_SCHEMA_VERSION);
  return Object.freeze({
    schemaVersion,
    automationId: requiredString(workflow.automationId, 'workflow.automationId'),
    version: positiveInteger(workflow.version, 'workflow.version'),
    trigger: normalizeTrigger(workflow.trigger),
    steps: normalizeSteps(workflow.steps),
    inputs: freezeJson(plainObject(workflow.inputs ?? {}, 'workflow.inputs'), 'workflow.inputs'),
    delivery: freezeJson(plainObject(workflow.delivery, 'workflow.delivery'), 'workflow.delivery'),
    executionPolicy: freezeJson(plainObject(workflow.executionPolicy, 'workflow.executionPolicy'), 'workflow.executionPolicy'),
    scope: normalizeScope(workflow.scope),
    createdBy: requiredString(workflow.createdBy, 'workflow.createdBy'),
    updatedBy: requiredString(workflow.updatedBy, 'workflow.updatedBy'),
    createdAt: timestamp(workflow.createdAt, 'workflow.createdAt'),
    updatedAt: timestamp(workflow.updatedAt, 'workflow.updatedAt'),
    provenance: freezeJson(plainObject(workflow.provenance, 'workflow.provenance'), 'workflow.provenance')
  });
}

function legacyTaskId(task) {
  return requiredString(task.id ?? task.task_id, 'self-notification task id');
}

function legacyScope(task) {
  const scope = task.scopeContext ?? {};
  return {
    globalUserId: scope.globalUserId ?? task.global_user_id,
    projectScope: scope.projectScope ?? task.project_scope,
    groupScope: scope.groupScope ?? task.group_scope ?? null,
    threadScope: scope.threadScope ?? task.thread_scope ?? null
  };
}

export function adaptSelfNotificationTaskToWorkflow(task) {
  plainObject(task, 'self-notification task');
  if (task.kind !== 'self-notification') throw new TypeError('only self-notification tasks can use the legacy workflow adapter');
  const payload = plainObject(task.payload, 'self-notification task.payload');
  const automationId = legacyTaskId(task);
  const scope = legacyScope(task);
  const globalUserId = requiredString(scope.globalUserId, 'self-notification scope.globalUserId');
  const recurrence = payload.recurrence ?? null;
  const runAt = task.runAt ?? task.available_at ?? null;
  const createdAt = task.createdAt ?? task.created_at;
  const updatedAt = task.updatedAt ?? task.updated_at ?? createdAt;
  const message = requiredString(payload.message, 'self-notification task.payload.message');
  const maxAttempts = positiveInteger(task.maxAttempts ?? task.max_attempts ?? 3, 'self-notification maxAttempts');

  return createWorkflowDefinition({
    automationId,
    version: 1,
    trigger: recurrence == null
      ? { type: 'one-shot', runAt: runAt == null ? null : timestamp(runAt, 'self-notification runAt') }
      : { type: 'recurring', recurrence: freezeJson(recurrence, 'self-notification recurrence') },
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message },
    delivery: plainObject(payload.delivery, 'self-notification task.payload.delivery'),
    executionPolicy: {
      maxAttempts,
      protectedAction: task.protectedAction === true || task.protected_action === true,
      confirmationRequired: task.confirmationRequired === true || task.confirmation_required === true
    },
    scope,
    createdBy: globalUserId,
    updatedBy: globalUserId,
    createdAt,
    updatedAt,
    provenance: {
      source: payload.automation?.source ?? 'legacy-self-notification',
      capability: payload.automation?.capability ?? null,
      legacyTaskId: automationId,
      traceContext: task.traceContext ?? {}
    }
  });
}
