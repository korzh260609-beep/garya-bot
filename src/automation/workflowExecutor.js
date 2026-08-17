import { createWorkflowDefinition } from './workflowContract.js';
import { isProtectedWorkflowStep } from './workflowExecutionSecurity.js';
import { evaluateAutonomousReadOnlyPolicy } from './workflowReadOnlyAutonomy.js';
import { evaluateStateChangeExecutionEnvelope, isStateChangingWorkflowStep } from './workflowStateChangeEnvelope.js';

export const WORKFLOW_EXECUTION_OUTCOMES = Object.freeze([
  'completed',
  'partial',
  'failed',
  'denied',
  'cancelled'
]);

const DEFAULT_MAX_SERIALIZED_LENGTH = 8192;
const DEFAULT_PREVIEW_LENGTH = 8000;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function boundJson(value, { maxSerializedLength, previewLength, field }) {
  const normalized = value === undefined ? null : value;
  let serialized;
  try {
    serialized = JSON.stringify(normalized);
  } catch {
    throw new TypeError(`${field} must be JSON-compatible`);
  }
  if (serialized === undefined) throw new TypeError(`${field} must be JSON-compatible`);
  if (serialized.length <= maxSerializedLength) return JSON.parse(serialized);
  return Object.freeze({ truncated: true, preview: serialized.slice(0, previewLength) });
}

function normalizeStepResult(value, bounds, securityEvidenceRefs = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('workflow step handler result must be an object');
  const outcome = requiredString(value.outcome, 'workflow step result.outcome');
  if (!WORKFLOW_EXECUTION_OUTCOMES.includes(outcome)) throw new TypeError(`unsupported workflow execution outcome: ${outcome}`);
  if (value.evidenceRefs != null && !Array.isArray(value.evidenceRefs)) throw new TypeError('workflow step result.evidenceRefs must be an array');
  return Object.freeze({
    outcome,
    output: boundJson(value.output, { ...bounds, field: 'workflow step result.output' }),
    evidenceRefs: boundJson([...securityEvidenceRefs, ...(value.evidenceRefs ?? [])], { ...bounds, field: 'workflow step result.evidenceRefs' }),
    errorCode: value.errorCode == null ? null : String(value.errorCode),
    errorMessage: value.errorMessage == null ? null : String(value.errorMessage),
    retryable: value.retryable === true ? true : value.retryable === false ? false : null
  });
}

function deniedSecurityResult(verdict, bounds) {
  return Object.freeze({
    outcome: 'denied',
    output: null,
    evidenceRefs: boundJson(verdict?.evidenceRefs ?? [], { ...bounds, field: 'workflow execution security evidenceRefs' }),
    errorCode: verdict?.errorCode == null ? 'execution_security_denied' : String(verdict.errorCode),
    errorMessage: verdict?.errorMessage == null
      ? String(verdict?.reason ?? 'execution-time security re-check denied')
      : String(verdict.errorMessage),
    retryable: false
  });
}

function policyDeniedResult(verdict, bounds, field, defaultErrorCode, defaultMessage) {
  return Object.freeze({
    outcome: 'denied',
    output: null,
    evidenceRefs: boundJson(verdict?.evidenceRefs ?? [], { ...bounds, field }),
    errorCode: verdict?.errorCode == null ? defaultErrorCode : String(verdict.errorCode),
    errorMessage: String(verdict?.reason ?? defaultMessage),
    retryable: false
  });
}

function securityFailureVerdict(error) {
  return Object.freeze({
    allowed: false,
    protected: true,
    failedCheck: 'security-runtime',
    reason: 'execution-security-runtime-error',
    errorCode: error?.code == null ? 'execution_security_check_error' : String(error.code),
    errorMessage: error instanceof Error ? error.message : String(error),
    evidenceRefs: Object.freeze([])
  });
}

async function recordRunEventIfSupported(stepRunStore, event) {
  if (typeof stepRunStore?.recordRunEvent === 'function') await stepRunStore.recordRunEvent(event);
}

function gateEventPayload(verdict) {
  return Object.freeze({
    allowed: verdict?.allowed === true,
    protected: verdict?.protected === true,
    failedCheck: verdict?.failedCheck ?? null,
    reason: verdict?.reason ?? null,
    errorCode: verdict?.errorCode ?? null,
    evaluatedAt: verdict?.evaluatedAt ?? null
  });
}

async function recordDerivedRuntimeEvents({ stepRunStore, runId, step, stepIndex, result }) {
  if (['collect', 'retrieve'].includes(step.type)) {
    await recordRunEventIfSupported(stepRunStore, {
      runId, eventType: 'source-result', stepIndex,
      payload: {
        outcome: result.outcome,
        collectedAt: result.output?.collectedAt ?? null,
        sourceMetadata: result.output?.sourceMetadata ?? null,
        omissions: result.output?.data?.omissions ?? null
      },
      evidenceRefs: result.evidenceRefs
    });
  }
  const ai = result.output?.compositionMetadata?.ai;
  if (ai) {
    await recordRunEventIfSupported(stepRunStore, {
      runId, eventType: 'ai-call', stepIndex,
      payload: {
        provider: ai.provider ?? null, model: ai.model ?? null, costUsd: ai.costUsd ?? null,
        reason: ai.reason ?? null, traceId: ai.traceId ?? null, requestId: ai.requestId ?? null,
        attempts: ai.attempts ?? null, fallbackUsed: ai.fallbackUsed === true
      },
      evidenceRefs: result.evidenceRefs
    });
  }
  if (step.type === 'deliver') {
    const delivery = result.output?.delivery ?? result.output ?? {};
    await recordRunEventIfSupported(stepRunStore, {
      runId, eventType: 'delivery-result', stepIndex,
      payload: {
        status: delivery.status ?? null, deliveryId: delivery.deliveryId ?? null,
        failureCode: delivery.failureCode ?? delivery.errorCode ?? null,
        retryable: delivery.retryable === true
      },
      evidenceRefs: result.evidenceRefs
    });
  }
}

async function persistDeniedPolicyStep({ stepRunStore, runId, taskId, definition, verdict, bounds, field, defaultErrorCode, defaultMessage }) {
  const stepIndex = Number.isInteger(verdict.failedStepIndex) ? verdict.failedStepIndex : 0;
  const step = definition.steps[stepIndex] ?? definition.steps[0];
  const baseRecord = Object.freeze({
    runId,
    taskId,
    automationId: definition.automationId,
    workflowVersion: definition.version,
    stepIndex,
    stepType: step.type
  });
  const result = policyDeniedResult(verdict, bounds, field, defaultErrorCode, defaultMessage);
  await stepRunStore.recordStep({ ...baseRecord, status: 'running', output: null, evidenceRefs: [] });
  await stepRunStore.recordStep({
    ...baseRecord,
    status: result.outcome,
    output: result.output,
    evidenceRefs: result.evidenceRefs,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage
  });
  return Object.freeze({ stepIndex, stepType: step.type, ...result });
}

export function createWorkflowExecutor({
  stepHandlers,
  stepRunStore,
  executionSecurity = null,
  maxSerializedLength = DEFAULT_MAX_SERIALIZED_LENGTH,
  previewLength = DEFAULT_PREVIEW_LENGTH
} = {}) {
  if (!stepHandlers || typeof stepHandlers !== 'object' || Array.isArray(stepHandlers)) throw new TypeError('stepHandlers must be an object');
  requiredFunction(stepRunStore?.recordStep, 'stepRunStore.recordStep');
  if (executionSecurity != null) requiredFunction(executionSecurity.recheckProtectedStep, 'executionSecurity.recheckProtectedStep');
  positiveInteger(maxSerializedLength, 'maxSerializedLength');
  positiveInteger(previewLength, 'previewLength');
  if (previewLength >= maxSerializedLength) throw new TypeError('previewLength must be less than maxSerializedLength');
  const bounds = Object.freeze({ maxSerializedLength, previewLength });

  async function executeSteps({ taskId, workflow, traceContext = {}, runId = null } = {}) {
    const normalizedTaskId = requiredString(taskId, 'taskId');
    const definition = createWorkflowDefinition(workflow);
    const autonomyVerdict = evaluateAutonomousReadOnlyPolicy(definition);
    const autonomyEvidenceRefs = autonomyVerdict.allowed === true ? autonomyVerdict.evidenceRefs : [];
    const stateChangeVerdict = evaluateStateChangeExecutionEnvelope(definition);
    const stateChangeEvidenceRefs = stateChangeVerdict.allowed === true ? stateChangeVerdict.evidenceRefs : [];
    let overallOutcome = 'completed';
    let handoff = boundJson({ workflowInputs: definition.inputs }, { ...bounds, field: 'workflow initial handoff' });
    const stepRuns = [];

    if (autonomyVerdict.applies === true && autonomyVerdict.allowed !== true) {
      const denied = await persistDeniedPolicyStep({
        stepRunStore,
        runId,
        taskId: normalizedTaskId,
        definition,
        verdict: autonomyVerdict,
        bounds,
        field: 'autonomous read-only policy evidenceRefs',
        defaultErrorCode: 'autonomous_read_only_policy_denied',
        defaultMessage: 'autonomous read-only policy denied'
      });
      stepRuns.push(denied);
      return Object.freeze({
        taskId: normalizedTaskId,
        automationId: definition.automationId,
        workflowVersion: definition.version,
        outcome: 'denied',
        output: denied.output,
        evidenceRefs: denied.evidenceRefs,
        stepRuns: Object.freeze(stepRuns)
      });
    }

    if (stateChangeVerdict.applies === true && stateChangeVerdict.allowed !== true) {
      const denied = await persistDeniedPolicyStep({
        stepRunStore,
        runId,
        taskId: normalizedTaskId,
        definition,
        verdict: stateChangeVerdict,
        bounds,
        field: 'state-change execution envelope evidenceRefs',
        defaultErrorCode: 'state_change_execution_envelope_denied',
        defaultMessage: 'state-change execution envelope denied'
      });
      stepRuns.push(denied);
      return Object.freeze({
        taskId: normalizedTaskId,
        automationId: definition.automationId,
        workflowVersion: definition.version,
        outcome: 'denied',
        output: denied.output,
        evidenceRefs: denied.evidenceRefs,
        stepRuns: Object.freeze(stepRuns)
      });
    }

    for (let stepIndex = 0; stepIndex < definition.steps.length; stepIndex += 1) {
      const step = definition.steps[stepIndex];
      const baseRecord = Object.freeze({
        runId,
        taskId: normalizedTaskId,
        automationId: definition.automationId,
        workflowVersion: definition.version,
        stepIndex,
        stepType: step.type
      });

      await stepRunStore.recordStep({ ...baseRecord, status: 'running', output: null, evidenceRefs: [] });

      const stateChangeStepEvidenceRefs = isStateChangingWorkflowStep(step) ? stateChangeEvidenceRefs : [];
      let securityVerdict = null;
      if (isProtectedWorkflowStep(step)) {
        if (executionSecurity == null) {
          securityVerdict = Object.freeze({
            allowed: false,
            protected: true,
            failedCheck: 'security-runtime',
            reason: 'execution-security-runtime-unavailable',
            errorCode: 'execution_security_unavailable',
            errorMessage: 'protected workflow step requires execution-time security re-checks',
            evidenceRefs: Object.freeze([])
          });
        } else {
          try {
            securityVerdict = await executionSecurity.recheckProtectedStep(Object.freeze({
              taskId: normalizedTaskId,
              workflow: definition,
              step,
              stepIndex,
              handoff,
              traceContext: Object.freeze({ ...traceContext })
            }));
          } catch (error) {
            securityVerdict = securityFailureVerdict(error);
          }
        }

        await recordRunEventIfSupported(stepRunStore, {
          runId,
          eventType: 'gate-decision',
          stepIndex,
          payload: gateEventPayload(securityVerdict),
          evidenceRefs: securityVerdict?.evidenceRefs ?? []
        });

        if (securityVerdict?.allowed !== true) {
          const verdictWithPolicyEvidence = Object.freeze({
            ...securityVerdict,
            evidenceRefs: Object.freeze([
              ...autonomyEvidenceRefs,
              ...stateChangeStepEvidenceRefs,
              ...(securityVerdict?.evidenceRefs ?? [])
            ])
          });
          const result = deniedSecurityResult(verdictWithPolicyEvidence, bounds);
          await stepRunStore.recordStep({
            ...baseRecord,
            status: result.outcome,
            output: result.output,
            evidenceRefs: result.evidenceRefs,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage
          });
          stepRuns.push(Object.freeze({ stepIndex, stepType: step.type, ...result }));
          return Object.freeze({
            taskId: normalizedTaskId,
            automationId: definition.automationId,
            workflowVersion: definition.version,
            outcome: 'denied',
            output: result.output,
            evidenceRefs: result.evidenceRefs,
            retryable: result.retryable,
            stepRuns: Object.freeze(stepRuns)
          });
        }
      }

      let result;
      try {
        const handler = requiredFunction(stepHandlers[step.type], `stepHandlers.${step.type}`);
        const securityEvidenceRefs = [
          ...autonomyEvidenceRefs,
          ...stateChangeStepEvidenceRefs,
          ...(Array.isArray(securityVerdict?.evidenceRefs) ? securityVerdict.evidenceRefs : [])
        ];
        result = normalizeStepResult(await handler(Object.freeze({
          taskId: normalizedTaskId,
          workflow: definition,
          step,
          stepIndex,
          handoff,
          securityVerdict,
          traceContext: Object.freeze({ ...traceContext })
        })), bounds, securityEvidenceRefs);
      } catch (error) {
        await stepRunStore.recordStep({
          ...baseRecord,
          status: 'failed',
          output: null,
          evidenceRefs: [],
          errorCode: error?.code == null ? null : String(error.code),
          errorMessage: error instanceof Error ? error.message : String(error),
          retryable: error?.retryable === true
        });
        throw error;
      }

      await recordDerivedRuntimeEvents({ stepRunStore, runId, step, stepIndex, result });
      await stepRunStore.recordStep({
        ...baseRecord,
        status: result.outcome,
        output: result.output,
        evidenceRefs: result.evidenceRefs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        retryable: result.retryable
      });
      stepRuns.push(Object.freeze({ stepIndex, stepType: step.type, ...result }));

      if (result.outcome === 'partial') overallOutcome = 'partial';
      if (result.outcome === 'failed' || result.outcome === 'denied' || result.outcome === 'cancelled') {
        return Object.freeze({
          taskId: normalizedTaskId,
          automationId: definition.automationId,
          workflowVersion: definition.version,
          outcome: result.outcome,
          output: result.output,
          evidenceRefs: result.evidenceRefs,
          retryable: result.retryable,
          stepRuns: Object.freeze(stepRuns)
        });
      }

      handoff = boundJson({
        previousStep: {
          stepIndex,
          stepType: step.type,
          outcome: result.outcome,
          output: result.output,
          evidenceRefs: result.evidenceRefs
        }
      }, { ...bounds, field: `workflow handoff after step ${stepIndex}` });
    }

    const finalStep = stepRuns.at(-1) ?? null;
    return Object.freeze({
      taskId: normalizedTaskId,
      automationId: definition.automationId,
      workflowVersion: definition.version,
      outcome: overallOutcome,
      output: finalStep?.output ?? null,
      evidenceRefs: finalStep?.evidenceRefs ?? [],
      stepRuns: Object.freeze(stepRuns)
    });
  }

  async function execute(input = {}) {
    const normalizedTaskId = requiredString(input.taskId, 'taskId');
    const definition = createWorkflowDefinition(input.workflow);
    const attempt = input.attempt == null ? 1 : positiveInteger(input.attempt, 'attempt');
    const occurrenceId = requiredString(input.occurrenceId ?? input.traceContext?.occurrenceId ?? normalizedTaskId, 'occurrenceId');
    const runId = requiredString(input.runId ?? `${occurrenceId}:attempt:${attempt}`, 'runId');
    if (typeof stepRunStore.startRun === 'function') {
      await stepRunStore.startRun({
        runId, taskId: normalizedTaskId, automationId: definition.automationId,
        workflowVersion: definition.version, occurrenceId, attempt,
        traceId: input.traceContext?.traceId ?? null,
        requestId: input.traceContext?.requestId ?? null
      });
    }
    try {
      const result = await executeSteps({ ...input, taskId: normalizedTaskId, workflow: definition, runId });
      const completed = Object.freeze({ ...result, runId, occurrenceId, attempt });
      if (typeof stepRunStore.completeRun === 'function') {
        await stepRunStore.completeRun({
          runId, status: result.outcome, output: result.output, evidenceRefs: result.evidenceRefs,
          errorCode: result.errorCode ?? null, errorMessage: result.errorMessage ?? null,
          retryable: result.retryable ?? null
        });
      }
      return completed;
    } catch (error) {
      if (typeof stepRunStore.completeRun === 'function') {
        await stepRunStore.completeRun({
          runId, status: 'failed', output: null, evidenceRefs: [],
          errorCode: error?.code ?? null,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryable: error?.retryable === true
        });
      }
      throw error;
    }
  }

  return Object.freeze({ execute });
}
