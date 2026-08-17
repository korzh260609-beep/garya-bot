export const WORKFLOW_FAILURE_CLASSES = Object.freeze([
  'completed',
  'partial-resource-failure',
  'lost-authority',
  'temporary-failure',
  'permanent-failure',
  'delivery-failure',
  'cancelled',
  'invalid-result'
]);

const ACCEPTED_OUTCOMES = new Set(['completed', 'partial']);
const TERMINAL_OUTCOMES = new Set(['denied', 'cancelled']);
const SUCCESS_DELIVERY_STATUSES = new Set(['delivered', 'completed']);

function freezeEvaluation(value) {
  return Object.freeze({
    accepted: value.accepted === true,
    outcome: value.outcome,
    failureClass: value.failureClass,
    retryable: value.retryable === true,
    errorCode: value.errorCode ?? null,
    reason: value.reason ?? null
  });
}

function finalDelivery(result) {
  if (result?.delivery && typeof result.delivery === 'object') return result.delivery;
  if (result?.output?.delivery && typeof result.output.delivery === 'object') return result.output.delivery;
  const finalStep = Array.isArray(result?.stepRuns) ? result.stepRuns.at(-1) : null;
  if (finalStep?.stepType !== 'deliver') return null;
  if (finalStep.output?.delivery && typeof finalStep.output.delivery === 'object') return finalStep.output.delivery;
  return finalStep.output && typeof finalStep.output === 'object' ? finalStep.output : Object.freeze({ status: null });
}

function deliveryEvaluation(result) {
  const delivery = finalDelivery(result);
  if (delivery == null) return null;
  const status = typeof delivery.status === 'string' ? delivery.status : null;
  if (status && SUCCESS_DELIVERY_STATUSES.has(status)) return null;
  return freezeEvaluation({
    accepted: false,
    outcome: 'failed',
    failureClass: 'delivery-failure',
    retryable: delivery.retryable === true,
    errorCode: delivery.failureCode ?? delivery.errorCode ?? (status ? `delivery_${status}` : 'delivery_result_missing'),
    reason: delivery.reason ?? delivery.errorMessage ?? `final delivery did not complete: ${status ?? 'missing status'}`
  });
}

export function evaluateDurableExecutionResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return freezeEvaluation({
      accepted: false,
      outcome: 'failed',
      failureClass: 'invalid-result',
      retryable: false,
      errorCode: 'durable_execution_result_invalid',
      reason: 'durable executor must return a structured result'
    });
  }

  const delivery = deliveryEvaluation(result);
  if (delivery) return delivery;

  if (typeof result.outcome === 'string') {
    if (ACCEPTED_OUTCOMES.has(result.outcome)) {
      return freezeEvaluation({
        accepted: true,
        outcome: result.outcome,
        failureClass: result.outcome === 'partial' ? 'partial-resource-failure' : 'completed',
        retryable: false
      });
    }
    if (result.outcome === 'failed') {
      return freezeEvaluation({
        accepted: false,
        outcome: 'failed',
        failureClass: result.retryable === true ? 'temporary-failure' : 'permanent-failure',
        retryable: result.retryable === true,
        errorCode: result.errorCode ?? 'workflow_execution_failed',
        reason: result.errorMessage ?? 'workflow execution failed'
      });
    }
    if (TERMINAL_OUTCOMES.has(result.outcome)) {
      return freezeEvaluation({
        accepted: false,
        outcome: result.outcome,
        failureClass: result.outcome === 'denied' ? 'lost-authority' : 'cancelled',
        retryable: false,
        errorCode: result.errorCode ?? `workflow_execution_${result.outcome}`,
        reason: result.errorMessage ?? `workflow execution ${result.outcome}`
      });
    }
    return freezeEvaluation({
      accepted: false,
      outcome: 'failed',
      failureClass: 'invalid-result',
      retryable: false,
      errorCode: 'workflow_execution_outcome_invalid',
      reason: `unsupported workflow execution outcome: ${result.outcome}`
    });
  }

  if (typeof result.status === 'string') {
    if (SUCCESS_DELIVERY_STATUSES.has(result.status)) {
      return freezeEvaluation({ accepted: true, outcome: 'completed', failureClass: 'completed', retryable: false });
    }
    if (['failed', 'denied', 'cancelled', 'dead_letter'].includes(result.status)) {
      return freezeEvaluation({
        accepted: false,
        outcome: result.status === 'denied' ? 'denied' : result.status === 'cancelled' ? 'cancelled' : 'failed',
        failureClass: result.status === 'denied' ? 'lost-authority' : result.status === 'cancelled' ? 'cancelled' : result.retryable === true ? 'temporary-failure' : 'permanent-failure',
        retryable: result.retryable === true && result.status === 'failed',
        errorCode: result.errorCode ?? `durable_execution_${result.status}`,
        reason: result.errorMessage ?? `durable execution returned ${result.status}`
      });
    }
  }

  // Existing registered executors predate Workflow Executor outcomes. Preserve
  // only their explicit positive contracts while rejecting ambiguous objects.
  if (result.ok === true || result.verified === true || result.acknowledged === true) {
    return freezeEvaluation({ accepted: true, outcome: 'completed', failureClass: 'completed', retryable: false });
  }

  return freezeEvaluation({
    accepted: false,
    outcome: 'failed',
    failureClass: 'invalid-result',
    retryable: false,
    errorCode: 'durable_execution_result_ambiguous',
    reason: 'durable executor result has no explicit successful outcome'
  });
}

export function createDurableExecutionOutcomeError(evaluation) {
  const error = new Error(evaluation?.reason ?? 'durable execution did not complete');
  error.name = 'DurableExecutionOutcomeError';
  error.code = evaluation?.errorCode ?? 'durable_execution_failed';
  error.retryable = evaluation?.retryable === true;
  error.failureClass = evaluation?.failureClass ?? 'invalid-result';
  return error;
}
