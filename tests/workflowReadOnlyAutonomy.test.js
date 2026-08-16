import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTONOMOUS_READ_ONLY_STEP_TYPES,
  evaluateAutonomousReadOnlyPolicy,
  createWorkflowExecutor
} from '../src/automation/index.js';

function workflow({
  steps = [{ type: 'collect', security: { protected: true } }],
  executionPolicy = { autonomousReadOnly: true, confirmationRequired: false }
} = {}) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.5:test',
    version: 1,
    trigger: { type: 'one-shot', runAt: '2026-08-17T07:00:00.000Z' },
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

test('AW2.5 autonomous read-only policy has a closed canonical step allowlist', () => {
  assert.deepEqual(AUTONOMOUS_READ_ONLY_STEP_TYPES, ['collect', 'retrieve', 'analyze', 'compose']);
  assert.equal(Object.isFrozen(AUTONOMOUS_READ_ONLY_STEP_TYPES), true);

  const verdict = evaluateAutonomousReadOnlyPolicy(workflow({
    steps: AUTONOMOUS_READ_ONLY_STEP_TYPES.map((type) => ({ type, security: { protected: true } }))
  }));

  assert.equal(verdict.applies, true);
  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.evidenceRefs, ['policy:autonomous-read-only']);
});

test('AW2.5 does not alter workflows that did not request autonomous read-only execution', () => {
  const verdict = evaluateAutonomousReadOnlyPolicy(workflow({
    steps: [{ type: 'deliver' }],
    executionPolicy: { maxAttempts: 3 }
  }));

  assert.equal(verdict.applies, false);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'autonomous-read-only-not-requested');
});

test('AW2.5 requires explicit no-per-occurrence-confirmation policy', () => {
  for (const confirmationRequired of [undefined, true]) {
    const verdict = evaluateAutonomousReadOnlyPolicy(workflow({
      executionPolicy: { autonomousReadOnly: true, ...(confirmationRequired === undefined ? {} : { confirmationRequired }) }
    }));

    assert.equal(verdict.applies, true);
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.errorCode, 'autonomous_read_only_confirmation_policy_required');
  }
});

test('AW2.5 denies state-changing or delivery step classes inside autonomous read-only policy', () => {
  for (const type of ['invoke-capability', 'deliver']) {
    const verdict = evaluateAutonomousReadOnlyPolicy(workflow({
      steps: [{ type, security: { protected: true } }]
    }));

    assert.equal(verdict.allowed, false);
    assert.equal(verdict.failedStepIndex, 0);
    assert.equal(verdict.errorCode, 'autonomous_read_only_step_type_denied');
  }
});

test('AW2.5 requires every autonomous read-only step to remain protected by AW2.4 security', () => {
  const verdict = evaluateAutonomousReadOnlyPolicy(workflow({
    steps: [
      { type: 'collect', security: { protected: true } },
      { type: 'analyze' }
    ]
  }));

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.failedStepIndex, 1);
  assert.equal(verdict.errorCode, 'autonomous_read_only_unprotected_step_denied');
});

test('AW2.5 executor fails closed before handler when autonomous policy is invalid', async () => {
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

  const result = await executor.execute({
    taskId: 'task:aw2.5:state-change-denied',
    workflow: workflow({ steps: [{ type: 'invoke-capability', security: { protected: true } }] })
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(handlerCalls, 0);
  assert.deepEqual(store.records.map(({ status }) => status), ['running', 'denied']);
  assert.equal(store.records[1].errorCode, 'autonomous_read_only_step_type_denied');
});

test('AW2.5 approved autonomous read-only execution still rechecks AW2.4 security before every step', async () => {
  const store = memoryStore();
  const calls = [];
  let rechecks = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep({ stepIndex }) {
        rechecks += 1;
        calls.push(`security:${stepIndex}:${rechecks}`);
        return { allowed: true, evidenceRefs: [`security:${stepIndex}:${rechecks}`] };
      }
    },
    stepHandlers: {
      collect: async ({ stepIndex }) => {
        calls.push(`handler:${stepIndex}:${rechecks}`);
        return { outcome: 'completed', output: { fresh: 1 }, evidenceRefs: ['source:fresh'] };
      },
      retrieve: async ({ stepIndex }) => {
        calls.push(`handler:${stepIndex}:${rechecks}`);
        return { outcome: 'completed', output: { source: 2 }, evidenceRefs: ['source:approved'] };
      },
      analyze: async ({ stepIndex }) => {
        calls.push(`handler:${stepIndex}:${rechecks}`);
        return { outcome: 'completed', output: { metric: 3 } };
      },
      compose: async ({ stepIndex }) => {
        calls.push(`handler:${stepIndex}:${rechecks}`);
        return { outcome: 'completed', output: { text: 'fresh report' } };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.5:allowed',
    workflow: workflow({
      steps: AUTONOMOUS_READ_ONLY_STEP_TYPES.map((type) => ({ type, security: { protected: true } }))
    })
  });

  assert.equal(result.outcome, 'completed');
  assert.equal(rechecks, 4);
  assert.deepEqual(calls, [
    'security:0:1', 'handler:0:1',
    'security:1:2', 'handler:1:2',
    'security:2:3', 'handler:2:3',
    'security:3:4', 'handler:3:4'
  ]);
  assert.deepEqual(store.records[1].evidenceRefs, ['policy:autonomous-read-only', 'security:0:1', 'source:fresh']);
  assert.deepEqual(store.records[3].evidenceRefs, ['policy:autonomous-read-only', 'security:1:2', 'source:approved']);
  assert.deepEqual(store.records[5].evidenceRefs, ['policy:autonomous-read-only', 'security:2:3']);
  assert.deepEqual(store.records[7].evidenceRefs, ['policy:autonomous-read-only', 'security:3:4']);
});

test('AW2.5 authority loss still denies before the protected handler', async () => {
  const store = memoryStore();
  let handlerCalls = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep() {
        return { allowed: false, reason: 'resource-authority-revoked', evidenceRefs: ['authority:revoked'] };
      }
    },
    stepHandlers: {
      collect: async () => {
        handlerCalls += 1;
        return { outcome: 'completed', output: { mustNotExist: true } };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.5:authority-revoked',
    workflow: workflow()
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(handlerCalls, 0);
  assert.deepEqual(result.evidenceRefs, ['policy:autonomous-read-only', 'authority:revoked']);
});
