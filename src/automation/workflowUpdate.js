import { createWorkflowDefinition } from './workflowContract.js';
import { parseRecurrenceRule } from '../temporal/recurrenceEngine.js';
import { compileWorkflowLifecycleOperation, normalizeWorkflowLifecycleOperation, workflowLifecycleOperationNeedsHistory } from './workflowNaturalLanguageLifecycle.js';

export const WORKFLOW_MUTATION_FIELDS = Object.freeze([
  'trigger',
  'steps',
  'inputs',
  'delivery',
  'executionPolicy'
]);

export const WORKFLOW_LIFECYCLE_ACTIONS = Object.freeze(['pause', 'resume', 'cancel']);
export const WORKFLOW_SEMANTIC_SELECTOR_FIELDS = Object.freeze([
  'triggerType',
  'recurrence',
  'timeZone',
  'localTime',
  'notificationMessage',
  'description',
  'lifecycleStatus'
]);

const WORKFLOW_ID_SELECTOR_FIELDS = Object.freeze(['automationId', 'taskId', 'scheduleId']);
const WORKFLOW_POSITION_SELECTOR_FIELD = 'position';
const SEMANTIC_CANDIDATE_LIMIT = 200;

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

function normalizedSemanticText(value, field) {
  return requiredString(value, field).replace(/\s+/g, ' ').toLocaleLowerCase('und');
}

function normalizedLocalTime(value, field) {
  const raw = requiredString(value, field);
  const match = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  const hour = match ? Number(match[1]) : -1;
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new WorkflowUpdateError('workflow_update_selector_invalid', `${field} must be HH:MM`);
  }
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function normalizedRecurrence(value, field) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value.rule : value;
  try {
    return parseRecurrenceRule(requiredString(raw, field)).canonical;
  } catch (error) {
    throw new WorkflowUpdateError('workflow_update_selector_invalid', `${field} must be a valid recurrence rule`, { cause: error?.message ?? null });
  }
}

function normalizeSelector(value) {
  const selector = plainObject(value, 'selector');
  const allowed = [...WORKFLOW_ID_SELECTOR_FIELDS, ...WORKFLOW_SEMANTIC_SELECTOR_FIELDS, WORKFLOW_POSITION_SELECTOR_FIELD];
  const normalized = {};
  for (const key of WORKFLOW_ID_SELECTOR_FIELDS) {
    if (selector[key] != null) normalized[key] = requiredString(selector[key], `selector.${key}`);
  }
  if (selector.triggerType != null) {
    const triggerType = requiredString(selector.triggerType, 'selector.triggerType');
    if (!['one-shot', 'recurring'].includes(triggerType)) {
      throw new WorkflowUpdateError('workflow_update_selector_invalid', `unsupported selector.triggerType: ${triggerType}`);
    }
    normalized.triggerType = triggerType;
  }
  if (selector.recurrence != null) normalized.recurrence = normalizedRecurrence(selector.recurrence, 'selector.recurrence');
  if (selector.timeZone != null) normalized.timeZone = requiredString(selector.timeZone, 'selector.timeZone');
  if (selector.localTime != null) normalized.localTime = normalizedLocalTime(selector.localTime, 'selector.localTime');
  if (selector.notificationMessage != null) normalized.notificationMessage = normalizedSemanticText(selector.notificationMessage, 'selector.notificationMessage');
  if (selector.description != null) normalized.description = normalizedSemanticText(selector.description, 'selector.description');
  if (selector.lifecycleStatus != null) normalized.lifecycleStatus = requiredString(selector.lifecycleStatus, 'selector.lifecycleStatus').toLocaleLowerCase('und');
  if (selector.position != null) {
    const position = Number(selector.position);
    if (!Number.isInteger(position) || position < 1 || position > 100) {
      throw new WorkflowUpdateError('workflow_update_selector_invalid', 'selector.position must be an integer from 1 to 100');
    }
    normalized.position = position;
  }
  const unsupported = Object.keys(selector).filter((key) => !allowed.includes(key));
  if (unsupported.length) {
    throw new WorkflowUpdateError('workflow_update_selector_invalid', `unsupported selector fields: ${unsupported.join(', ')}`);
  }
  if (Object.keys(normalized).length === 0) {
    throw new WorkflowUpdateError('workflow_update_selector_required', 'at least one structured workflow selector is required');
  }
  return Object.freeze(normalized);
}

function hasSemanticSelector(selector) {
  return WORKFLOW_SEMANTIC_SELECTOR_FIELDS.some((field) => selector[field] != null) || selector.position != null;
}

function workflowRecurrence(workflow) {
  if (workflow.trigger?.type !== 'recurring') return null;
  const value = workflow.trigger.recurrence?.rule ?? workflow.trigger.recurrence;
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    return parseRecurrenceRule(value.trim()).canonical;
  } catch {
    return null;
  }
}

function workflowTimeZone(workflow) {
  return workflow.trigger?.timeZone ?? workflow.trigger?.recurrence?.timeZone ?? null;
}

function workflowLocalTime(workflow) {
  const local = workflow.trigger?.dtstartLocal ?? workflow.trigger?.recurrence?.dtstartLocal ?? null;
  if (typeof local !== 'string') return null;
  const match = local.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function workflowNotificationMessage(workflow) {
  const value = workflow.inputs?.notificationMessage ?? workflow.inputs?.message ?? null;
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('und')
    : null;
}

const DESCRIPTION_STOP_WORDS = new Set([
  'automation', 'task', 'workflow', 'reminder', 'schedule', 'change', 'update', 'add', 'remove',
  'автоматизация', 'автоматизацию', 'автоматизации', 'задача', 'задачу', 'задачи', 'напоминание',
  'измени', 'изменить', 'добавь', 'добавить', 'убери', 'удали', 'эта', 'эту', 'этой',
  'автоматизація', 'автоматизацію', 'автоматизації', 'завдання', 'нагадування', 'зміни', 'змінити',
  'додай', 'додати', 'видали', 'це', 'цю', 'цієї', 'the', 'this', 'that', 'with', 'для', 'про'
]);

function descriptionTokens(value) {
  return String(value ?? '').toLocaleLowerCase('und').match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length >= 3 && !DESCRIPTION_STOP_WORDS.has(token)) ?? [];
}

function tokenEquivalent(left, right) {
  if (left === right) return true;
  const length = Math.min(left.length, right.length);
  const prefix = length >= 6 ? 5 : length >= 4 ? 4 : 3;
  return length >= 3 && left.slice(0, prefix) === right.slice(0, prefix);
}

function workflowDescriptionText(record) {
  const workflow = createWorkflowDefinition(record.workflow);
  const values = [workflowNotificationMessage(workflow), workflow.delivery?.title, workflow.delivery?.message];
  return values.filter((value) => typeof value === 'string' && value.trim() !== '').join(' ');
}

function descriptionMatch(record, description) {
  const query = [...new Set(descriptionTokens(description))];
  const candidate = [...new Set(descriptionTokens(workflowDescriptionText(record)))];
  if (query.length === 0 || candidate.length === 0) return Object.freeze({ score: 0, matches: 0 });
  const matches = query.filter((token) => candidate.some((item) => tokenEquivalent(token, item))).length;
  return Object.freeze({ score: matches / query.length, matches });
}

function semanticRecordMatches(record, selector) {
  const workflow = createWorkflowDefinition(record.workflow);
  if (selector.automationId && workflow.automationId !== selector.automationId) return false;
  if (selector.taskId && record.taskId !== selector.taskId) return false;
  if (selector.scheduleId && record.scheduleId !== selector.scheduleId) return false;
  if (selector.triggerType && workflow.trigger.type !== selector.triggerType) return false;
  if (selector.recurrence && workflowRecurrence(workflow) !== selector.recurrence) return false;
  if (selector.timeZone && workflowTimeZone(workflow) !== selector.timeZone) return false;
  if (selector.localTime && workflowLocalTime(workflow) !== selector.localTime) return false;
  if (selector.notificationMessage && workflowNotificationMessage(workflow) !== selector.notificationMessage) return false;
  if (selector.lifecycleStatus && String(record.lifecycleStatus ?? '').toLocaleLowerCase('und') !== selector.lifecycleStatus) return false;
  return true;
}

function humanChoice(record) {
  const workflow = createWorkflowDefinition(record.workflow);
  return Object.freeze({
    title: workflow.inputs?.notificationMessage ?? workflow.inputs?.message ?? 'Автоматизация без названия',
    localTime: workflowLocalTime(workflow),
    recurrence: workflowRecurrence(workflow),
    lifecycleStatus: record.lifecycleStatus ?? null
  });
}

function resolveDescriptionMatches(records, description) {
  const ranked = records.map((record) => ({ record, ...descriptionMatch(record, description) }))
    .filter((item) => item.matches >= 1 && (item.score >= 0.5 || item.matches >= 2))
    .sort((left, right) => right.score - left.score || right.matches - left.matches);
  if (ranked.length === 0) return [];
  const best = ranked[0];
  const second = ranked[1] ?? null;
  if (second && best.score - second.score < 0.2 && best.matches === second.matches) {
    return ranked.filter((item) => best.score - item.score < 0.2 && best.matches === item.matches).map((item) => item.record);
  }
  return [best.record];
}

function targetResolutionError(matchCount, records = []) {
  if (matchCount === 0) {
    return new WorkflowUpdateError(
      'workflow_update_target_not_found',
      'No existing automation matches that description in the current scope. Which automation do you mean?',
      { matchCount: 0, clarificationRequired: true }
    );
  }
  return new WorkflowUpdateError(
    'workflow_update_target_ambiguous',
    'Several existing automations match that description in the current scope. Which one do you mean?',
    { matchCount, clarificationRequired: true, choices: Object.freeze(records.slice(0, 5).map(humanChoice)) }
  );
}

function eligibleLifecycleStatuses({ selector, lifecycleAction, semanticOperation }) {
  if (selector.lifecycleStatus) return Object.freeze([selector.lifecycleStatus]);
  const operation = semanticOperation?.type ?? lifecycleAction ?? null;
  if (operation === 'pause') return Object.freeze(['active']);
  if (operation === 'resume') return Object.freeze(['paused']);
  if (operation === 'cancel') return Object.freeze(['active', 'paused', 'error']);
  return Object.freeze(['active', 'paused', 'error']);
}

async function resolveTarget({ store, selector, scope, recurringScheduler = null, lifecycleAction = null, semanticOperation = null }) {
  if (!hasSemanticSelector(selector)) {
    const matches = await store.resolve({ selector, scope });
    if (!Array.isArray(matches) || matches.length !== 1) throw targetResolutionError(Array.isArray(matches) ? matches.length : null);
    return matches[0];
  }
  if (typeof store.list !== 'function') {
    throw new WorkflowUpdateError('workflow_update_semantic_resolution_unavailable', 'semantic workflow target resolution is unavailable in this store');
  }
  const candidates = await store.list({ scope, limit: SEMANTIC_CANDIDATE_LIMIT + 1 });
  if (!Array.isArray(candidates)) {
    throw new WorkflowUpdateError('workflow_update_semantic_resolution_failed', 'workflow candidate lookup returned an invalid result');
  }
  if (candidates.length > SEMANTIC_CANDIDATE_LIMIT) {
    throw new WorkflowUpdateError(
      'workflow_update_target_set_too_large',
      'Too many automations exist in the current scope to select safely. Please describe the target more specifically.',
      { candidateCount: candidates.length, clarificationRequired: true }
    );
  }
  const eligibleStatuses = eligibleLifecycleStatuses({ selector, lifecycleAction, semanticOperation });
  const eligibleCandidates = candidates.filter((record) => eligibleStatuses.includes(String(record.lifecycleStatus ?? '').toLocaleLowerCase('und')));
  let matches;
  if (selector.position != null) {
    if (typeof recurringScheduler?.list !== 'function') {
      throw new WorkflowUpdateError('workflow_update_position_resolution_unavailable', 'numbered automation selection is unavailable', { clarificationRequired: true });
    }
    const schedules = await recurringScheduler.list({ scope, limit: 100 });
    const byScheduleId = new Map(eligibleCandidates.filter((record) => record.scheduleId).map((record) => [record.scheduleId, record]));
    const visibleOrder = schedules.flatMap((schedule) => byScheduleId.has(schedule.scheduleId) ? [byScheduleId.get(schedule.scheduleId)] : []);
    const selected = visibleOrder[selector.position - 1] ?? null;
    matches = selected && semanticRecordMatches(selected, selector) ? [selected] : [];
  } else {
    const structuredSelector = Object.freeze(Object.fromEntries(Object.entries(selector).filter(([key]) => key !== 'description')));
    const structuredMatches = eligibleCandidates.filter((record) => semanticRecordMatches(record, structuredSelector));
    const hasExplicitStructuredEvidence = Object.keys(structuredSelector).length > 0;
    matches = selector.description && !(hasExplicitStructuredEvidence && structuredMatches.length === 1)
      ? resolveDescriptionMatches(structuredMatches, selector.description)
      : structuredMatches;
  }
  if (matches.length !== 1) throw targetResolutionError(matches.length, matches);
  return matches[0];
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

function mutationSummary(patch, lifecycleAction, semanticPlan = null) {
  return Object.freeze({
    fields: Object.freeze(Object.keys(patch).sort()),
    lifecycleAction,
    ...(semanticPlan ? { semanticOperation: semanticPlan.operation.type } : {}),
    ...(semanticPlan?.restoredFromVersion ? { restoredFromVersion: semanticPlan.restoredFromVersion } : {})
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

async function applyLifecycleMutation({ recurringScheduler, oneShotTaskQueue, record, scope, lifecycleAction, transaction }) {
  if (lifecycleAction === null) return null;
  const scheduleId = record.scheduleId ?? null;
  if (scheduleId) {
    if (!recurringScheduler) throw new WorkflowUpdateError('workflow_update_scheduler_unavailable', 'scheduler is required for recurring lifecycle mutation');
    const method = recurringScheduler[lifecycleAction];
    if (typeof method !== 'function') throw new WorkflowUpdateError('workflow_update_scheduler_unsupported', `scheduler does not support ${lifecycleAction}`);
    const result = await method({ scope, scheduleId, transaction });
    if (!result) throw new WorkflowUpdateError('workflow_update_schedule_transition_denied', `schedule ${lifecycleAction} was not applied`);
    return result;
  }
  const taskId = record.taskId ?? null;
  if (!taskId) throw new WorkflowUpdateError('workflow_update_task_required', 'one-shot lifecycle mutation requires an existing task');
  const method = oneShotTaskQueue?.[`${lifecycleAction}Scheduled`];
  if (typeof method !== 'function') throw new WorkflowUpdateError('workflow_update_one_shot_lifecycle_unsupported', `durable task queue does not support ${lifecycleAction}`);
  const result = await method({ scope, taskId, transaction });
  if (!result) throw new WorkflowUpdateError('workflow_update_task_transition_denied', `one-shot task ${lifecycleAction} was not applied`);
  return result;
}

async function applyRuntimeMutation({ recurringScheduler, oneShotTaskQueue, record, next, scope, patch, lifecycleAction, transaction = null }) {
  const taskSync = await syncDurableTask({ oneShotTaskQueue, record, next, scope, patch, transaction });
  const triggerResult = patch.trigger === undefined
    ? null
    : await updateTrigger({ recurringScheduler, oneShotTaskQueue, record, next, scope, transaction });
  const lifecycleResult = await applyLifecycleMutation({ recurringScheduler, oneShotTaskQueue, record, scope, lifecycleAction, transaction });
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
    semanticOperation = null,
    expectedVersion = null,
    actor,
    provenance = {}
  } = {}) {
    const normalizedSelector = normalizeSelector(selector);
    const normalizedScope = plainObject(scope, 'scope');
    const requestedPatch = normalizePatch(patch);
    const requestedLifecycleAction = normalizeLifecycleAction(lifecycleAction);
    const normalizedSemanticOperation = semanticOperation == null ? null : normalizeWorkflowLifecycleOperation(semanticOperation);
    const normalizedProvenance = freezeJson(plainObject(provenance, 'provenance'));
    const globalUserId = actorId(actor);

    if (normalizedSemanticOperation && (Object.keys(requestedPatch).length > 0 || requestedLifecycleAction !== null)) {
      throw new WorkflowUpdateError('workflow_update_mutation_ambiguous', 'semanticOperation cannot be combined with patch or lifecycleAction');
    }
    if (!normalizedSemanticOperation && Object.keys(requestedPatch).length === 0 && requestedLifecycleAction === null) {
      throw new WorkflowUpdateError('workflow_update_empty_patch', 'workflow mutation must change at least one field or lifecycle state');
    }

    const record = await resolveTarget({
      store,
      selector: normalizedSelector,
      scope: normalizedScope,
      recurringScheduler,
      lifecycleAction: requestedLifecycleAction,
      semanticOperation: normalizedSemanticOperation
    });
    const current = createWorkflowDefinition(record.workflow);
    if (expectedVersion != null && expectedVersion !== current.version) {
      throw new WorkflowUpdateError(
        'workflow_update_version_conflict',
        `expected workflow version ${expectedVersion}, current version is ${current.version}`
      );
    }
    const needsHistory = normalizedSemanticOperation ? workflowLifecycleOperationNeedsHistory(normalizedSemanticOperation) : false;
    if (needsHistory && typeof store.history !== 'function') throw new WorkflowUpdateError('workflow_update_history_unavailable', 'workflow version history is required for restore');
    const operationHistory = needsHistory ? await store.history({ automationId: current.automationId, limit: 100 }) : [];
    if (needsHistory && !Array.isArray(operationHistory)) throw new WorkflowUpdateError('workflow_update_history_invalid', 'workflow version history is invalid');
    const semanticPlan = normalizedSemanticOperation
      ? compileWorkflowLifecycleOperation({ currentWorkflow: current, operation: normalizedSemanticOperation, history: operationHistory })
      : null;
    const normalizedPatch = normalizePatch(semanticPlan?.patch ?? requestedPatch);
    const normalizedLifecycleAction = normalizeLifecycleAction(semanticPlan?.lifecycleAction ?? requestedLifecycleAction);
    const mutationProvenance = normalizedSemanticOperation
      ? freezeJson({ ...normalizedProvenance, semanticOperation: normalizedSemanticOperation.type })
      : normalizedProvenance;

    const canonicalSelector = Object.freeze({ automationId: current.automationId });
    const gateResult = await authorization.authorize(Object.freeze({
      action: 'automation.update',
      actor: freezeJson(plainObject(actor, 'actor')),
      scope: freezeJson(normalizedScope),
      selector: canonicalSelector,
      requestedSelector: normalizedSelector,
      currentWorkflow: current,
      patch: normalizedPatch,
      lifecycleAction: normalizedLifecycleAction,
      semanticOperation: normalizedSemanticOperation
    }));
    if (gateResult?.allowed !== true) {
      throw new WorkflowUpdateError(
        'workflow_update_authorization_denied',
        String(gateResult?.reason ?? 'workflow update authorization denied'),
        { gateResult: freezeJson(gateResult ?? {}) }
      );
    }

    const now = timestamp(clock);
    const next = buildNextDefinition(current, normalizedPatch, globalUserId, mutationProvenance, now);
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
        provenance: mutationProvenance,
        gateResult: freezeJson(gateResult),
        patchSummary: mutationSummary(normalizedPatch, normalizedLifecycleAction, semanticPlan),
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
        provenance: mutationProvenance,
        gateResult: freezeJson(gateResult),
        patchSummary: mutationSummary(normalizedPatch, normalizedLifecycleAction, semanticPlan),
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
      task: runtimeResult?.task ?? null,
      semanticOperation: normalizedSemanticOperation?.type ?? null,
      restoredFromVersion: semanticPlan?.restoredFromVersion ?? null
    });
  }

  async function history({ selector, scope, limit = 50 } = {}) {
    if (typeof store.history !== 'function') throw new TypeError('workflow update store.history is required');
    const normalizedSelector = normalizeSelector(selector);
    const record = await resolveTarget({ store, selector: normalizedSelector, scope: plainObject(scope, 'scope'), recurringScheduler });
    return store.history({ automationId: record.workflow.automationId, limit });
  }

  return Object.freeze({ update, history });
}
