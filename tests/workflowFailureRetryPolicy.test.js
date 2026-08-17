import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableWorker } from '../src/automation/durableWorker.js';
import {
  createDurableExecutionOutcomeError,
  evaluateDurableExecutionResult
} from '../src/automation/workflowFailurePolicy.js';

test('AW2.15 accepts honest partial completion without retry and preserves explicit partial semantics', () => {
  const evaluation = evaluateDurableExecutionResult({
    outcome: 'partial',
    output: { omissions: [{ workspaceId: 'tgw_aw215missing', reason: 'resource-authority-revoked' }] }
  });

  assert.deepEqual(evaluation, {
    accepted: true,
    outcome: 'partial',
    failureClass: 'partial-resource-failure',
    retryable: false,
    errorCode: null,
    reason: null
  });
});

test('AW2.15 classifies lost authority and permanent capability failures as terminal', () => {
  const denied = evaluateDurableExecutionResult({ outcome: 'denied', errorCode: 'resource_authority_revoked' });
  const permanent = evaluateDurableExecutionResult({ outcome: 'failed', retryable: false, errorCode: 'capability_not_registered' });

  assert.equal(denied.failureClass, 'lost-authority');
  assert.equal(denied.retryable, false);
  assert.equal(permanent.failureClass, 'permanent-failure');
  assert.equal(permanent.retryable, false);
});

test('AW2.15 permits bounded queue retry only for explicitly temporary failures', () => {
  const temporary = evaluateDurableExecutionResult({
    outcome: 'failed',
    retryable: true,
    errorCode: 'provider_temporarily_unavailable',
    errorMessage: 'provider temporarily unavailable'
  });
  const error = createDurableExecutionOutcomeError(temporary);

  assert.equal(temporary.failureClass, 'temporary-failure');
  assert.equal(error.retryable, true);
  assert.equal(error.code, 'provider_temporarily_unavailable');
});

test('AW2.15 final delivery cannot report success unless delivery is explicitly delivered', () => {
  const missing = evaluateDurableExecutionResult({
    outcome: 'completed',
    stepRuns: [{ stepType: 'deliver', outcome: 'completed', output: {} }]
  });
  const temporary = evaluateDurableExecutionResult({
    outcome: 'completed',
    stepRuns: [{ stepType: 'deliver', outcome: 'failed', output: { status: 'provider-unavailable', retryable: true, failureCode: 'telegram_unavailable' } }]
  });
  const delivered = evaluateDurableExecutionResult({
    outcome: 'completed',
    stepRuns: [{ stepType: 'deliver', outcome: 'completed', output: { status: 'delivered' } }]
  });

  assert.equal(missing.accepted, false);
  assert.equal(missing.errorCode, 'delivery_result_missing');
  assert.equal(temporary.failureClass, 'delivery-failure');
  assert.equal(temporary.retryable, true);
  assert.equal(delivered.accepted, true);
});

function fakeQueue(task) {
  const calls = { complete: [], fail: [] };
  let claimed = false;
  return {
    calls,
    async releaseDue() { return []; },
    async recoverAbandoned() { return []; },
    async claim() {
      if (claimed) return null;
      claimed = true;
      return { ...task, status: 'running', lease_owner: 'worker:aw215' };
    },
    async heartbeat() {},
    async complete(input) {
      calls.complete.push(input);
      return { ...task, status: 'completed' };
    },
    async fail(input) {
      calls.fail.push(input);
      return {
        outcome: input.error.retryable ? 'retry' : 'dead_letter',
        delayMs: input.error.retryable ? input.baseDelayMs : null,
        task: { ...task, status: input.error.retryable ? 'queued' : 'dead_letter' }
      };
    }
  };
}

test('AW2.15 durable worker sends returned temporary failure to existing bounded queue backoff instead of completing it', async () => {
  const queue = fakeQueue({
    task_id: 'task:aw215:temporary', kind: 'workflow', payload: {}, attempt: 1,
    max_attempts: 3, global_user_id: 'user:aw215', project_scope: 'sg2.1'
  });
  const worker = createDurableWorker({
    workerId: 'worker:aw215', queue,
    leaseMs: 1000, heartbeatMs: 100,
    retryBaseDelayMs: 25, retryMaxDelayMs: 200,
    actionGate: async () => ({ allowed: true }),
    executor: async () => ({ outcome: 'failed', retryable: true, errorCode: 'temporary_provider_failure' })
  });

  const result = await worker.runOnce();

  assert.equal(result.status, 'queued');
  assert.equal(queue.calls.complete.length, 0);
  assert.equal(queue.calls.fail.length, 1);
  assert.equal(queue.calls.fail[0].error.retryable, true);
  assert.equal(queue.calls.fail[0].baseDelayMs, 25);
  assert.equal(queue.calls.fail[0].maxDelayMs, 200);
});

test('AW2.15 durable worker dead-letters returned terminal denial and never marks it completed', async () => {
  const queue = fakeQueue({
    task_id: 'task:aw215:denied', kind: 'workflow', payload: {}, attempt: 1,
    max_attempts: 3, global_user_id: 'user:aw215', project_scope: 'sg2.1'
  });
  const worker = createDurableWorker({
    workerId: 'worker:aw215', queue,
    leaseMs: 1000, heartbeatMs: 100,
    actionGate: async () => ({ allowed: true }),
    executor: async () => ({ outcome: 'denied', errorCode: 'resource_authority_revoked' })
  });

  const result = await worker.runOnce();

  assert.equal(result.status, 'dead_letter');
  assert.equal(queue.calls.complete.length, 0);
  assert.equal(queue.calls.fail[0].error.retryable, false);
  assert.equal(queue.calls.fail[0].error.failureClass, 'lost-authority');
});

test('AW2.15 rejects ambiguous executor objects to prevent false success', () => {
  const evaluation = evaluateDurableExecutionResult({ message: 'looks fine' });
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.failureClass, 'invalid-result');
  assert.equal(evaluation.retryable, false);
  assert.equal(evaluation.errorCode, 'durable_execution_result_ambiguous');
});
