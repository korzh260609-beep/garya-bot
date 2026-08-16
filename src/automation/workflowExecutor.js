import { createWorkflowDefinition } from './workflowContract.js';
import { isProtectedWorkflowStep } from './workflowExecutionSecurity.js';

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

function normalizeStepResult(value, bounds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('workflow step handler result must be an object');
  const outcome = requiredString(value.outcome, 'workflow step result.outcome');
  if (!WORKFLOW_EXECUTION_OUTCOMES.includes(outcome)) throw new TypeError(`unsupported workflow execution outcome: ${outcome}`);
  if (value.evidenceRefs != null && !Array.isArray(value.evidenceRefs)) throw new TypeError('workflow step result.evidenceRefs must be an array');
  return Object.freeze({
    outcome,
    output: boundJson(value.output, { ...bounds, field: 'workflow step result.output' }),
    evidenceRefs: boundJson(value.evidenceRefs ?? [], { ...bounds, field: 'workflow step result.evidenceRefs' }),
    errorCode: value.errorCode == null ? null : String(value.errorCode),
    errorMessage: value.errorMessage == null ? null : String(value.errorMessage)
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
      : String(verdict.errorMessage)
  });
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

  async function execute({ taskId, workflow, traceContext = {} } = {}) {
    const normalizedTaskId = requiredString(taskId, 'taskId');
    const definition = createWorkflowDefinition(workflow);
    let overallOutcome = 'completed';
    let handoff = boundJson({ workflowInputs: definition.inputs }, { ...bounds, field: 'workflow initial handoff' });
    const stepRuns = [];

    for (let stepIndex = 0; stepIndex < definition.steps.length; stepIndex += 1) {
      const step = definition.steps[stepIndex];
      const handler = requiredFunction(stepHandlers[step.type], `stepHandlers.${step.type}`);
      const baseRecord = Object.freeze({
        taskId: normalizedTaskId,
        automationId: definition.automationId,
        workflowVersion: definition.version,
        stepIndex,
        stepType: step.type
      });

      await stepRunStore.recordStep({ ...baseRecord, status: 'running', output: null, evidenceRefs: [] });

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
          securityVerdict = await executionSecurity.recheckProtectedStep(Object.freeze({
            taskId: normalizedTaskId,
            workflow: definition,
            step,
            stepIndex,
            handoff,
            traceContext: Object.freeze({ ...traceContext })
          }));
        }

        if (securityVerdict?.allowed !== true) {
          const result = deniedSecurityResult(securityVerdict, bounds);
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
            stepRuns: Object.freeze(stepRuns)
          });
        }
      }

      let result;
      try {
        result = normalizeStepResult(await handler(Object.freeze({
          taskId: normalizedTaskId,
          workflow: definition,
          step,
          stepIndex,
          handoff,
          securityVerdict,
          traceContext: Object.freeze({ ...traceContext })
        })), bounds);
      } catch (error) {
        await stepRunStore.recordStep({
          ...baseRecord,
          status: 'failed',
          output: null,
          evidenceRefs: [],
          errorCode: error?.code == null ? null : String(error.code),
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      await stepRunStore.recordStep({
        ...baseRecord,
        status: result.outcome,
        output: result.output,
        evidenceRefs: result.evidenceRefs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
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

  return Object.freeze({ execute });
}
