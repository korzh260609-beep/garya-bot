export const AUTONOMOUS_READ_ONLY_STEP_TYPES = Object.freeze([
  'collect',
  'retrieve',
  'analyze',
  'compose'
]);

function freezeVerdict(value) {
  return Object.freeze({
    ...value,
    evidenceRefs: Object.freeze([...(value.evidenceRefs ?? [])])
  });
}

export function isAutonomousReadOnlyRequested(workflow) {
  return workflow?.executionPolicy?.autonomousReadOnly === true;
}

export function evaluateAutonomousReadOnlyPolicy(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    throw new TypeError('workflow must be an object');
  }

  if (!isAutonomousReadOnlyRequested(workflow)) {
    return freezeVerdict({
      applies: false,
      allowed: false,
      reason: 'autonomous-read-only-not-requested',
      evidenceRefs: []
    });
  }

  if (workflow.executionPolicy?.confirmationRequired !== false) {
    return freezeVerdict({
      applies: true,
      allowed: false,
      reason: 'autonomous-read-only-requires-explicit-no-per-occurrence-confirmation',
      errorCode: 'autonomous_read_only_confirmation_policy_required',
      evidenceRefs: []
    });
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return freezeVerdict({
      applies: true,
      allowed: false,
      reason: 'autonomous-read-only-requires-steps',
      errorCode: 'autonomous_read_only_invalid_steps',
      evidenceRefs: []
    });
  }

  for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex += 1) {
    const step = workflow.steps[stepIndex];
    if (!AUTONOMOUS_READ_ONLY_STEP_TYPES.includes(step?.type)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: `autonomous-read-only-step-type-not-allowed:${String(step?.type ?? 'missing')}`,
        errorCode: 'autonomous_read_only_step_type_denied',
        evidenceRefs: []
      });
    }
    if (step?.security?.protected !== true) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'autonomous-read-only-step-must-remain-protected',
        errorCode: 'autonomous_read_only_unprotected_step_denied',
        evidenceRefs: []
      });
    }
  }

  return freezeVerdict({
    applies: true,
    allowed: true,
    reason: null,
    evidenceRefs: ['policy:autonomous-read-only']
  });
}
