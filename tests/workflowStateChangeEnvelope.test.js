import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATE_CHANGING_WORKFLOW_STEP_TYPES,
  STATE_CHANGE_CONFIRMATION_POLICIES,
  STATE_CHANGE_DELEGATION_POLICIES,
  evaluateStateChangeExecutionEnvelope,
  createWorkflowExecutor
} from '../src/automation/index.js';

function stateChangeStep(overrides = {}) {
  return {
    type: 'invoke-capability',
    capability: 'workspace-content-publish',
    security: { protected: true },
    executionEnvelope: {
      capability: 'workspace-content-publish',
      resourceScope: { workspaceId: 'workspace:test' },
      actionClass: 'workspace.content.publish',
      risk: 'external-state-change',
      confirmationPolicy: 'per-execution',
      delegationPolicy: 'none'
    },
    ...overrides
  };
}

function workflow({
  steps = [stateChangeStep()],
  executionPolicy = { confirmationRequired: true },
  trigger = { type: 'one-shot', runAt: '2026-08-17T07:00:00.000Z' }
} = {}) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.6:test',
    version: 1,
    trigger,
    steps,
    inputs: { seed: 'value' },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy,
    scope: { globalUserId: 'user:test', projectScope: 'sg2.1' },
    createdBy: 'user:test',
    updatedBy: 'user:test',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    provenance: { source: 'test' }
  };
}

function memoryStore() {
  const records = [];
  return {
    records,
    async recordStep(record) {
      records.push(structuredClone(record));
      return record;
    }
  };
}

test('AW2.6 exposes closed typed state-change envelope contracts', () => {
  assert.deepEqual(STATE_CHANGING_WORKFLOW_STEP_TYPES, ['invoke-capability']);
  assert.deepEqual(STATE_CHANGE_CONFIRMATION_POLICIES, ['per-execution', 'delegated']);
  assert.deepEqual(STATE_CHANGE_DELEGATION_POLICIES, ['none', 'bounded']);
  assert.equal(Object.isFrozen(STATE_CHANGING_WORKFLOW_STEP_TYPES), true);
  assert.equal(Object.isFrozen(STATE_CHANGE_CONFIRMATION_POLICIES), true);
  assert.equal(Object.isFrozen(STATE_CHANGE_DELEGATION_POLICIES), true);
});

test('AW2.6 leaves workflows without state-changing canonical steps unchanged', () => {
  const verdict = evaluateStateChangeExecutionEnvelope(workflow({
    steps: [{ type: 'collect', security: { protected: true } }],
    executionPolicy: { autonomousReadOnly: true, confirmationRequired: false }
  }));

  assert.equal(verdict.applies, false);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'state-change-envelope-not-required');
});

test('AW2.6 state-changing steps require protection and an explicit bounded envelope', () => {
  const unprotected = evaluateStateChangeExecutionEnvelope(workflow({
    steps: [stateChangeStep({ security: { protected: false } })]
  }));
  assert.equal(unprotected.allowed, false);
  assert.equal(unprotected.errorCode, 'state_change_unprotected_step_denied');

  const missingEnvelopeStep = stateChangeStep();
  delete missingEnvelopeStep.executionEnvelope;
  const missingEnvelope = evaluateStateChangeExecutionEnvelope(workflow({ steps: [missingEnvelopeStep] }));
  assert.equal(missingEnvelope.allowed, false);
  assert.equal(missingEnvelope.errorCode, 'state_change_execution_envelope_required');
});

test('AW2.6 fails closed when capability, resource scope, action class or risk is missing', () => {
  const cases = [
    ['capability', 'state_change_capability_required'],
    ['resourceScope', 'state_change_resource_scope_required'],
    ['actionClass', 'state_change_action_class_required'],
    ['risk', 'state_change_risk_required']
  ];

  for (const [field, expectedCode] of cases) {
    const step = stateChangeStep();
    step.executionEnvelope = { ...step.executionEnvelope };
    delete step.executionEnvelope[field];
    const verdict = evaluateStateChangeExecutionEnvelope(workflow({ steps: [step] }));
    assert.equal(verdict.allowed, false, field);
    assert.equal(verdict.errorCode, expectedCode, field);
  }
});

test('AW2.6 rejects a capability envelope that does not match the typed step capability', () => {
  const step = stateChangeStep();
  step.executionEnvelope = { ...step.executionEnvelope, capability: 'different-capability' };
  const verdict = evaluateStateChangeExecutionEnvelope(workflow({ steps: [step] }));

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.errorCode, 'state_change_capability_mismatch');
});

test('AW2.6 per-execution confirmation requires explicit workflow confirmation and no delegation', () => {
  for (const executionPolicy of [{}, { confirmationRequired: false }]) {
    const verdict = evaluateStateChangeExecutionEnvelope(workflow({ executionPolicy }));
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.errorCode, 'state_change_confirmation_policy_mismatch');
  }

  const delegatedStep = stateChangeStep();
  delegatedStep.executionEnvelope = { ...delegatedStep.executionEnvelope, delegationPolicy: 'bounded' };
  const delegatedVerdict = evaluateStateChangeExecutionEnvelope(workflow({ steps: [delegatedStep] }));
  assert.equal(delegatedVerdict.allowed, false);
  assert.equal(delegatedVerdict.errorCode, 'state_change_confirmation_policy_mismatch');
});

test('AW2.6 delegated execution requires explicit bounded delegation reference and no per-occurrence confirmation', () => {
  const validDelegated = stateChangeStep();
  validDelegated.executionEnvelope = {
    ...validDelegated.executionEnvelope,
    confirmationPolicy: 'delegated',
    delegationPolicy: 'bounded',
    delegationRef: 'delegation:workspace:test:publish'
  };

  const allowed = evaluateStateChangeExecutionEnvelope(workflow({
    steps: [validDelegated],
    executionPolicy: { confirmationRequired: false }
  }));
  assert.equal(allowed.allowed, true);
  assert.deepEqual(allowed.evidenceRefs, ['policy:state-change-execution-envelope']);

  for (const executionPolicy of [{ confirmationRequired: true }, { confirmationRequired: false }]) {
    const invalid = stateChangeStep();
    invalid.executionEnvelope = {
      ...invalid.executionEnvelope,
      confirmationPolicy: 'delegated',
      delegationPolicy: 'bounded',
      ...(executionPolicy.confirmationRequired === false ? {} : { delegationRef: 'delegation:test' })
    };
    const verdict = evaluateStateChangeExecutionEnvelope(workflow({ steps: [invalid], executionPolicy }));
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.errorCode, 'state_change_delegation_policy_required');
  }
});

test('AW2.6 executor denies an invalid envelope before resolving or invoking the state-changing handler', async () => {
  const store = memoryStore();
  let handlerCalls = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    stepHandlers: {
      'invoke-capability': async () => {
        handlerCalls += 1;
        return { outcome: 'completed', output: { changed: true } };
      }
    }
  });
  const step = stateChangeStep();
  delete step.executionEnvelope;

  const result = await executor.execute({
    taskId: 'task:aw2.6:invalid-envelope',
    workflow: workflow({ steps: [step] })
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(result.stepRuns[0].errorCode, 'state_change_execution_envelope_required');
  assert.equal(handlerCalls, 0);
  assert.deepEqual(store.records.map(({ status }) => status), ['running', 'denied']);
});

test('AW2.6 valid envelope never bypasses AW2.4 execution-time security', async () => {
  const store = memoryStore();
  let securityCalls = 0;
  let handlerCalls = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep({ step }) {
        securityCalls += 1;
        assert.equal(step.executionEnvelope.capability, 'workspace-content-publish');
        return { allowed: false, reason: 'current-action-gate-denied', evidenceRefs: ['action-gate:denied'] };
      }
    },
    stepHandlers: {
      'invoke-capability': async () => {
        handlerCalls += 1;
        return { outcome: 'completed', output: { changed: true } };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.6:runtime-denied',
    workflow: workflow()
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(securityCalls, 1);
  assert.equal(handlerCalls, 0);
  assert.deepEqual(result.evidenceRefs, [
    'policy:state-change-execution-envelope',
    'action-gate:denied'
  ]);
});

test('AW2.6 scheduled delegated execution remains bounded by current runtime authority', async () => {
  const store = memoryStore();
  let handlerCalls = 0;
  const delegatedStep = stateChangeStep();
  delegatedStep.executionEnvelope = {
    ...delegatedStep.executionEnvelope,
    confirmationPolicy: 'delegated',
    delegationPolicy: 'bounded',
    delegationRef: 'delegation:workspace:test:publish'
  };
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep() {
        return { allowed: false, reason: 'resource-authority-revoked', evidenceRefs: ['authority:revoked'] };
      }
    },
    stepHandlers: {
      'invoke-capability': async () => {
        handlerCalls += 1;
        return { outcome: 'completed', output: { changed: true } };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.6:scheduled-revoked',
    workflow: workflow({
      steps: [delegatedStep],
      executionPolicy: { confirmationRequired: false },
      trigger: { type: 'recurring', recurrence: { frequency: 'daily', timezone: 'Europe/Kyiv' } }
    })
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(handlerCalls, 0);
  assert.deepEqual(result.evidenceRefs, [
    'policy:state-change-execution-envelope',
    'authority:revoked'
  ]);
});

test('AW2.6 valid envelope evidence is persisted only on the state-changing step', async () => {
  const store = memoryStore();
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep({ stepIndex }) {
        return { allowed: true, evidenceRefs: [`security:${stepIndex}`] };
      }
    },
    stepHandlers: {
      collect: async () => ({ outcome: 'completed', output: { value: 1 }, evidenceRefs: ['source:read'] }),
      'invoke-capability': async () => ({ outcome: 'completed', output: { changed: true }, evidenceRefs: ['capability:changed'] })
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.6:allowed',
    workflow: workflow({
      steps: [
        { type: 'collect', security: { protected: true } },
        stateChangeStep()
      ]
    })
  });

  assert.equal(result.outcome, 'completed');
  assert.deepEqual(store.records[1].evidenceRefs, ['security:0', 'source:read']);
  assert.deepEqual(store.records[3].evidenceRefs, [
    'policy:state-change-execution-envelope',
    'security:1',
    'capability:changed'
  ]);
});
