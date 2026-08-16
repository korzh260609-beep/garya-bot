import { createWorkflowDefinition } from './workflowContract.js';

export const WORKFLOW_MUTATION_FIELDS = Object.freeze([
  'trigger',
  'steps',
  'inputs',
  'delivery',
  'executionPolicy'
]);

export const WORKFLOW_LIFECYCLE_ACTIONS = Object.freeze(['pause', 'resume', 'cancel']);

export class WorkflowUpdateError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'WorkflowUpdateError';
    this.code = code;
    this.details = details;
    this.retryable = false;
  }
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new WorkflowUpdateError('workflow_update_invalid_request', `${field} must be a non-empty string`);
  }
  return value.trim();
}

function plainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowUpdateError('workflow_update_invalid_request', `${field} must be an object`);
  }
  return value;
}

function freezeJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJson));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeJson(item)])));
  }
  throw new WorkflowUpdateError('workflow_update_invalid_request', 'mutation data must be JSON-compatible');
}

function normalizeSelector(value) {
  const selector = plainObject(value, 'selector');
  const allowed = ['automationId', 'taskId', 'scheduleId'];
  const normalized = {};
  for (const key of allowed) {
    if (selector[key] != null) normalized[key] = requiredString(selector[key], `selector.${key}`);
  }
  if (Object.keys(normalized).length === 0) {
    throw new WorkflowUpdateError('workflow_update_selector_required', 'at least one structured workflow selector is required');
  }
  const unsupported = Object.keys(selector).filter((key) => !allowed.includes(key));
  if (unsupported.length) {
    throw new WorkflowUpdateError('workflow_update_selector_invalid', `unsupported selector fields: ${unsupported.join(', ')}`);
  }
  return Object.freeze(normalized);
}

function normalizePatch(value = {}) {
  const patch = plainObject(value, 'patch');
  const unsupported = Object.keys(patch).filter((key) => !WORKFLOW_MUTATION_FIELDS.includes(key));
  if (unsupported.length) {
    throw new WorkflowUpdateError(
      'workflow_update_patch_field_forbidden',
      `workflow mutation cannot change protected fields: ${unsupported.join(', ')}`
    );
  }
  return freezeJson(patch);
}

function normalizeLifecycleAction(value) {
  if (value == null) return null;
  const action = requiredString(value, 'lifecycleAction');
  if (!WORKFLOW_LIFECYCLE_ACTIONS.includes(action)) {
    throw new WorkflowUpdateError('workflow_update_lifecycle_invalid', `unsupported lifecycle action: ${action}`);
  }
  return action;
}

function actorId(actor) {
  return requiredString(actor?.globalUserId, 'actor.globalUserId');
}

function timestamp(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new WorkflowUpdateError('workflow_update_clock_invalid', 'clock must return a valid timestamp');
  }
  return date.toISOString();
}

function mutationSummary(patch, lifecycleAction) {
  return Object.freeze({
    fields: Object.freeze(Object.keys(patch).sort()),
    lifecycleAction
  });
}

function buildNextDefinition(current, patch, actorGlobalUserId, provenance, now) {
  return createWorkflowDefinition({
    ...current,
    ...patch,
    automationId: current.automationId,
    version: current.version + 1,
    scope: current.scope,
    createdBy: current.createdBy,
    createdAt: current.createdAt,
    updatedBy: actorGlobalUserId,
    updatedAt: now,
    provenance: {
      ...current.provenance,
      ...provenance,
      previousVersion: current.version,
      mutation: true
    }
  });
}

async function syncDurableTask({ oneShotTaskQueue, record, next, scope, patch, transaction }) {
  if (Object.keys(patch).length === 0 || !record.taskId || typeof oneShotTaskQueue?.syncWorkflowTask !== 'function') return null;
  const result = await oneShotTaskQueue.syncWorkflowTask({
    scope,
    taskId: record.taskId,
    workflow: next,
    allowTerminal: Boolean(record.scheduleId),
    transaction
  });
  if (!result) {
    throw new WorkflowUpdateError('workflow_update_task_sync_denied', 'durable task/template could not be synchronized with the workflow version');
  }
  return Object.freeze({ taskId: record.taskId, status: result.status ?? null, workflowVersion: next.version });
}

async function updateTrigger({ recurringScheduler, oneShotTaskQueue, record, next, scope, transaction }) {
  const scheduleId = record.scheduleId ?? null;
  const taskId = record.taskId ?? null;

  if (next.trigger.type === 'one-shot') {
    if (scheduleId) {
      throw new WorkflowUpdateError('workflow_update_trigger_type_change_unsupported', 'recurring automation cannot be converted to one-shot in AW2.7');
    }
    if (!taskId) throw new WorkflowUpdateError('workflow_update_task_required', 'one-shot trigger mutation requires an existing task');
    if (typeof oneShotTaskQueue?.updateScheduled !== 'function') {
      throw new WorkflowUpdateError('workflow_update_one_shot_unavailable', 'existing durable task queue cannot update one-shot schedule');
    }
    const runAt = requiredString(next.trigger.runAt, 'workflow.trigger.runAt');
    const result = await oneShotTaskQueue.updateScheduled({
      scope,
      taskId,
      runAt,
      workflowVersion: next.version,
      automationId: next.automationId,
      transaction
    });
    if (!result) throw new WorkflowUpdateError('workflow_update_one_shot_update_denied', 'one-shot task is not safely updatable in its current state');
    return Object.freeze({ taskId, runAt, status: result.status ?? null, workflowVersion: next.version });
  }

  if (!recurringScheduler) {
    throw new WorkflowUpdateError('workflow_update_scheduler_unavailable', 'scheduler is required for recurring trigger mutation');
  }
  if (!scheduleId) {
    throw new WorkflowUpdateError('workflow_update_trigger_type_change_unsupported', 'one-shot automation cannot be converted to recurring in AW2.7');
  }
  if (typeof recurringScheduler.update !== 'function') {
    throw new WorkflowUpdateError('workflow_update_scheduler_unsupported', 'scheduler does not support update');
  }

  const recurrence = next.trigger.recurrence?.rule ?? next.trigger.recurrence ?? null;
  const timeZone = next.trigger.timeZone ?? next.trigger.recurrence?.timeZone ?? null;
  const dtstartLocal = next.trigger.dtstartLocal ?? next.trigger.recurrence?.dtstartLocal ?? null;
  const result = await recurringScheduler.update({
    scope,
    scheduleId,
    recurrence,
    timeZone,
    dtstartLocal,
    state: {
      workflowVersion: next.version,
      automationId: next.automationId
    },
    transaction
  });
  if (!result) {
    throw new WorkflowUpdateError('workflow_update_schedule_update_denied', 'recurring schedule update was not applied');
  }
  return result;
}

async function applyLifecycleMutation({ recurringScheduler, record, scope, lifecycleAction, transaction }) {
  if (lifecycleAction === null) return null;
  const scheduleId = record.scheduleId ?? null;
  if (!scheduleId) {
    throw new WorkflowUpdateError('workflow_update_schedule_required', 'pause/resume/cancel currently require an existing recurring schedule');
  }
  if (!recurringScheduler) {
    throw new WorkflowUpdateError('workflow_update_scheduler_unavailable', 'scheduler is required for lifecycle mutation');
  }
  const method = recurringScheduler[lifecycleAction];
  if (typeof method !== 'function') {
    throw new WorkflowUpdateError('workflow_update_scheduler_unsupported', `scheduler does not support ${lifecycleAction}`);
  }
  const result = await method({ scope, scheduleId, transaction });
  if (!result) {
    throw new WorkflowUpdateError('workflow_update_schedule_transition_denied', `schedule ${lifecycleAction} was not applied`);
  }
  return result;
}

async function applyRuntimeMutation({ recurringScheduler, oneShotTaskQueue, record, next, scope, patch, lifecycleAction, transaction = null }) {
  const taskSync = await syncDurableTask({ oneShotTaskQueue, record, next, scope, patch, transaction });
  const triggerResult = patch.trigger === undefined
    ? null
    : await updateTrigger({ recurringScheduler, oneShotTaskQueue, record, next, scope, transaction });
  const lifecycleResult = await applyLifecycleMutation({ recurringScheduler, record, scope, lifecycleAction, transaction });
  const scheduleResult = lifecycleResult ?? (record.scheduleId ? triggerResult : null);
  const oneShotResult = !record.scheduleId && triggerResult ? triggerResult : taskSync;
  return Object.freeze({ schedule: scheduleResult, task: oneShotResult, taskSync });
}

export function createWorkflowUpdateCapability({
  store,
  authorization,
  recurringScheduler = null,
  oneShotTaskQueue = null,
  clock = () => new Date()
} = {}) {
  if (typeof store?.resolve !== 'function' || typeof store?.commitMutation !== 'function') {
    throw new TypeError('workflow update store with resolve and commitMutation is required');
  }
  if (typeof authorization?.authorize !== 'function') {
    throw new TypeError('workflow update authorization.authorize is required');
  }
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function update({
    selector,
    scope,
    patch = {},
    lifecycleAction = null,
    expectedVersion = null,
    actor,
    provenance = {}
  } = {}) {
    const normalizedSelector = normalizeSelector(selector);
    const normalizedScope = plainObject(scope, 'scope');
    const normalizedPatch = normalizePatch(patch);
    const normalizedLifecycleAction = normalizeLifecycleAction(lifecycleAction);
    const normalizedProvenance = freezeJson(plainObject(provenance, 'provenance'));
    const globalUserId = actorId(actor);

    if (Object.keys(normalizedPatch).length === 0 && normalizedLifecycleAction === null) {
      throw new WorkflowUpdateError('workflow_update_empty_patch', 'workflow mutation must change at least one field or lifecycle state');
    }

    const matches = await store.resolve({ selector: normalizedSelector, scope: normalizedScope });
    if (!Array.isArray(matches) || matches.length !== 1) {
      throw new WorkflowUpdateError(
        matches?.length === 0 ? 'workflow_update_target_not_found' : 'workflow_update_target_ambiguous',
        matches?.length === 0 ? 'no workflow matched the selector' : 'multiple workflows matched the selector',
        { matchCount: Array.isArray(matches) ? matches.length : null }
      );
    }

    const record = matches[0];
    const current = createWorkflowDefinition(record.workflow);
    if (expectedVersion != null && expectedVersion !== current.version) {
      throw new WorkflowUpdateError(
        'workflow_update_version_conflict',
        `expected workflow version ${expectedVersion}, current version is ${current.version}`
      );
    }

    const gateResult = await authorization.authorize(Object.freeze({
      action: 'automation.update',
      actor: freezeJson(plainObject(actor, 'actor')),
      scope: freezeJson(normalizedScope),
      selector: normalizedSelector,
      currentWorkflow: current,
      patch: normalizedPatch,
      lifecycleAction: normalizedLifecycleAction
    }));
    if (gateResult?.allowed !== true) {
      throw new WorkflowUpdateError(
        'workflow_update_authorization_denied',
        String(gateResult?.reason ?? 'workflow update authorization denied'),
        { gateResult: freezeJson(gateResult ?? {}) }
      );
    }

    const now = timestamp(clock);
    const next = buildNextDefinition(current, normalizedPatch, globalUserId, normalizedProvenance, now);
    const runtimeMutation = (transaction) => applyRuntimeMutation({
      recurringScheduler,
      oneShotTaskQueue,
      record,
      next,
      scope: normalizedScope,
      patch: normalizedPatch,
      lifecycleAction: normalizedLifecycleAction,
      transaction
    });

    let committed;
    let runtimeResult;
    if (store.atomicRuntimeMutation === true) {
      const atomic = await store.commitMutation({
        record,
        currentWorkflow: current,
        nextWorkflow: next,
        expectedVersion: current.version,
        actor: freezeJson(plainObject(actor, 'actor')),
        provenance: normalizedProvenance,
        gateResult: freezeJson(gateResult),
        patchSummary: mutationSummary(normalizedPatch, normalizedLifecycleAction),
        lifecycleAction: normalizedLifecycleAction,
        runtimeMutation
      });
      committed = atomic?.record ?? null;
      runtimeResult = atomic?.runtimeResult ?? null;
    } else {
      runtimeResult = await runtimeMutation(null);
      committed = await store.commitMutation({
        record,
        currentWorkflow: current,
        nextWorkflow: next,
        expectedVersion: current.version,
        actor: freezeJson(plainObject(actor, 'actor')),
        provenance: normalizedProvenance,
        gateResult: freezeJson(gateResult),
        patchSummary: mutationSummary(normalizedPatch, normalizedLifecycleAction),
        lifecycleAction: normalizedLifecycleAction,
        scheduleResult: runtimeResult?.schedule ?? null
      });
    }

    if (!committed) {
      throw new WorkflowUpdateError('workflow_update_commit_conflict', 'workflow mutation was not committed');
    }
    return Object.freeze({
      automationId: next.automationId,
      previousVersion: current.version,
      version: next.version,
      workflow: next,
      lifecycleAction: normalizedLifecycleAction,
      schedule: runtimeResult?.schedule ?? null,
      task: runtimeResult?.task ?? null
    });
  }

  async function history({ selector, scope, limit = 50 } = {}) {
    if (typeof store.history !== 'function') throw new TypeError('workflow update store.history is required');
    const normalizedSelector = normalizeSelector(selector);
    const matches = await store.resolve({ selector: normalizedSelector, scope: plainObject(scope, 'scope') });
    if (!Array.isArray(matches) || matches.length !== 1) {
      throw new WorkflowUpdateError(
        matches?.length === 0 ? 'workflow_update_target_not_found' : 'workflow_update_target_ambiguous',
        matches?.length === 0 ? 'no workflow matched the selector' : 'multiple workflows matched the selector'
      );
    }
    return store.history({ automationId: matches[0].workflow.automationId, limit });
  }

  return Object.freeze({ update, history });
}
