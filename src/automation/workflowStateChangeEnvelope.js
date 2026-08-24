export const STATE_CHANGING_WORKFLOW_STEP_TYPES = Object.freeze([
  'invoke-capability'
]);

export const STATE_CHANGE_CONFIRMATION_POLICIES = Object.freeze([
  'per-execution',
  'delegated'
]);

export const STATE_CHANGE_DELEGATION_POLICIES = Object.freeze([
  'none',
  'bounded'
]);

function freezeVerdict(value) {
  return Object.freeze({
    ...value,
    evidenceRefs: Object.freeze([...(value.evidenceRefs ?? [])])
  });
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function nonEmptyPlainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length > 0
  );
}

export function isStateChangingWorkflowStep(step) {
  return STATE_CHANGING_WORKFLOW_STEP_TYPES.includes(step?.type);
}

export function evaluateStateChangeExecutionEnvelope(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    throw new TypeError('workflow must be an object');
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return freezeVerdict({
      applies: false,
      allowed: false,
      reason: 'state-change-envelope-no-steps',
      evidenceRefs: []
    });
  }

  const stateChangingIndexes = workflow.steps
    .map((step, index) => isStateChangingWorkflowStep(step) ? index : null)
    .filter((index) => index != null);

  if (stateChangingIndexes.length === 0) {
    return freezeVerdict({
      applies: false,
      allowed: false,
      reason: 'state-change-envelope-not-required',
      evidenceRefs: []
    });
  }

  for (const stepIndex of stateChangingIndexes) {
    const step = workflow.steps[stepIndex];
    const envelope = step?.executionEnvelope;

    if (step?.security?.protected !== true) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-changing-step-must-remain-protected',
        errorCode: 'state_change_unprotected_step_denied',
        evidenceRefs: []
      });
    }

    if (!nonEmptyPlainObject(envelope)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-changing-step-requires-explicit-execution-envelope',
        errorCode: 'state_change_execution_envelope_required',
        evidenceRefs: []
      });
    }

    if (!nonEmptyString(envelope.capability)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-capability-required',
        errorCode: 'state_change_capability_required',
        evidenceRefs: []
      });
    }

    if (nonEmptyString(step.capability) && step.capability.trim() !== envelope.capability.trim()) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-capability-mismatch',
        errorCode: 'state_change_capability_mismatch',
        evidenceRefs: []
      });
    }

    if (!nonEmptyPlainObject(envelope.resourceScope)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-resource-scope-required',
        errorCode: 'state_change_resource_scope_required',
        evidenceRefs: []
      });
    }

    if (!nonEmptyString(envelope.actionClass)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-action-class-required',
        errorCode: 'state_change_action_class_required',
        evidenceRefs: []
      });
    }

    if (!nonEmptyString(envelope.risk)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-risk-required',
        errorCode: 'state_change_risk_required',
        evidenceRefs: []
      });
    }

    if (!STATE_CHANGE_CONFIRMATION_POLICIES.includes(envelope.confirmationPolicy)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-confirmation-policy-invalid',
        errorCode: 'state_change_confirmation_policy_invalid',
        evidenceRefs: []
      });
    }

    if (!STATE_CHANGE_DELEGATION_POLICIES.includes(envelope.delegationPolicy)) {
      return freezeVerdict({
        applies: true,
        allowed: false,
        failedStepIndex: stepIndex,
        reason: 'state-change-envelope-delegation-policy-invalid',
        errorCode: 'state_change_delegation_policy_invalid',
        evidenceRefs: []
      });
    }

    if (envelope.confirmationPolicy === 'per-execution') {
      if (workflow.executionPolicy?.confirmationRequired !== true || envelope.delegationPolicy !== 'none') {
        return freezeVerdict({
          applies: true,
          allowed: false,
          failedStepIndex: stepIndex,
          reason: 'state-change-per-execution-confirmation-policy-mismatch',
          errorCode: 'state_change_confirmation_policy_mismatch',
          evidenceRefs: []
        });
      }
    }

    if (envelope.confirmationPolicy === 'delegated') {
      if (
        workflow.executionPolicy?.confirmationRequired !== false ||
        envelope.delegationPolicy !== 'bounded' ||
        !nonEmptyString(envelope.delegationRef)
      ) {
        return freezeVerdict({
          applies: true,
          allowed: false,
          failedStepIndex: stepIndex,
          reason: 'state-change-bounded-delegation-policy-required',
          errorCode: 'state_change_delegation_policy_required',
          evidenceRefs: []
        });
      }
    }
  }

  return freezeVerdict({
    applies: true,
    allowed: true,
    reason: null,
    evidenceRefs: ['policy:state-change-execution-envelope']
  });
}
