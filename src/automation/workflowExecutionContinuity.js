import { createWorkflowDefinition } from './workflowContract.js';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

export function deriveWorkflowOccurrenceId({ taskId, payload = {}, idempotencyKey = null } = {}) {
  if (payload?.occurrenceId != null) return requiredString(payload.occurrenceId, 'payload.occurrenceId');
  const recurrence = payload?.recurrence;
  if (recurrence?.scheduleId != null && recurrence?.sequence != null) {
    return `schedule:${requiredString(recurrence.scheduleId, 'payload.recurrence.scheduleId')}:${positiveInteger(Number(recurrence.sequence), 'payload.recurrence.sequence')}`;
  }
  if (idempotencyKey != null && String(idempotencyKey).trim() !== '') return `idempotency:${String(idempotencyKey).trim()}`;
  return `task:${requiredString(taskId, 'taskId')}`;
}

export function workflowDeliveryIdempotencyKey({ occurrenceId, stepIndex = 'final' } = {}) {
  const normalizedOccurrenceId = requiredString(occurrenceId, 'occurrenceId');
  const normalizedStep = Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : requiredString(stepIndex, 'stepIndex');
  return `automation-delivery:${normalizedOccurrenceId}:step:${normalizedStep}`;
}

export function createRestartContinuousWorkflowExecution({ workflowStore, workflowExecutor } = {}) {
  if (typeof workflowStore?.resolveVersion !== 'function') throw new TypeError('workflowStore.resolveVersion is required');
  if (typeof workflowExecutor?.execute !== 'function') throw new TypeError('workflowExecutor.execute is required');

  return Object.freeze({
    async execute({ taskId, payload = {}, attempt = 1, idempotencyKey = null, traceContext = {}, scope } = {}) {
      const reference = payload?.workflow;
      const automationId = requiredString(reference?.automationId, 'payload.workflow.automationId');
      const version = positiveInteger(Number(reference?.version), 'payload.workflow.version');
      const record = await workflowStore.resolveVersion({ automationId, version, scope });
      if (!record) {
        const error = new Error(`Pinned workflow version is unavailable: ${automationId}@${version}`);
        error.code = 'workflow-version-unavailable';
        error.retryable = false;
        throw error;
      }
      const workflow = createWorkflowDefinition(record.workflow ?? record);
      if (workflow.automationId !== automationId || workflow.version !== version) {
        const error = new Error('Resolved workflow does not match the pinned task reference');
        error.code = 'workflow-version-mismatch';
        error.retryable = false;
        throw error;
      }
      const occurrenceId = deriveWorkflowOccurrenceId({ taskId, payload, idempotencyKey });
      return workflowExecutor.execute({
        taskId: requiredString(taskId, 'taskId'),
        workflow,
        occurrenceId,
        attempt: positiveInteger(Number(attempt), 'attempt'),
        traceContext: Object.freeze({ ...traceContext, occurrenceId })
      });
    }
  });
}
