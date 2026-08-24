import { isProtectedWorkflowStep } from './workflowExecutionSecurity.js';

export const FRESH_DATA_COLLECTION_STEP_TYPES = Object.freeze(['collect']);

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function failClosed(message, code) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

function normalizeCollectionResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('collectCurrent must return an object');
  }
  if (value.evidenceRefs != null && !Array.isArray(value.evidenceRefs)) {
    throw new TypeError('collectCurrent.evidenceRefs must be an array');
  }
  if (value.outcome != null && typeof value.outcome !== 'string') {
    throw new TypeError('collectCurrent.outcome must be a string when provided');
  }
  return value;
}

export function isFreshDataCollectionStep(step) {
  return FRESH_DATA_COLLECTION_STEP_TYPES.includes(step?.type);
}

export function createRuntimeFreshDataCollectHandler({
  collectCurrent,
  clock = () => new Date().toISOString()
} = {}) {
  const currentCollector = requiredFunction(collectCurrent, 'collectCurrent');
  const currentClock = requiredFunction(clock, 'clock');

  return async function runtimeFreshDataCollectHandler(context = {}) {
    const step = context?.step;
    if (!isFreshDataCollectionStep(step)) {
      throw failClosed('runtime fresh-data handler accepts only collect steps', 'fresh_data_step_type_invalid');
    }
    if (!isProtectedWorkflowStep(step)) {
      throw failClosed('fresh-data collection requires execution-time protected security', 'fresh_data_security_required');
    }
    if (context?.securityVerdict?.allowed !== true) {
      throw failClosed('fresh-data collection requires a current allowed security verdict', 'fresh_data_security_not_current');
    }

    const collectedAt = currentClock();
    if (typeof collectedAt !== 'string' || collectedAt.trim() === '') {
      throw new TypeError('clock must return a non-empty timestamp string');
    }

    // Deliberately do not expose workflow inputs or prior handoff to the collector.
    // The collector receives only current execution identity/scope, typed step
    // configuration and the just-computed runtime security verdict, preventing
    // stored prepared text from being replayed as if it were fresh evidence.
    const collected = normalizeCollectionResult(await currentCollector(Object.freeze({
      taskId: context.taskId,
      automationId: context.workflow?.automationId ?? null,
      workflowVersion: context.workflow?.version ?? null,
      scope: context.workflow?.scope ?? null,
      step,
      stepIndex: context.stepIndex,
      securityVerdict: context.securityVerdict,
      traceContext: Object.freeze({ ...(context.traceContext ?? {}) })
    })));

    return Object.freeze({
      outcome: collected.outcome ?? 'completed',
      output: Object.freeze({
        collectedAt,
        data: collected.data ?? null,
        sourceMetadata: collected.sourceMetadata ?? null
      }),
      evidenceRefs: Object.freeze([...(collected.evidenceRefs ?? [])]),
      errorCode: collected.errorCode ?? null,
      errorMessage: collected.errorMessage ?? null
    });
  };
}
