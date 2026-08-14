import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableWorker } from '../src/automation/durableWorker.js';

test('self-notification always passes Action Gate even when protected_action is false', async () => {
  const deferUntil = '2026-08-15T05:00:00.000Z';
  const task = {
    task_id: 'self-notification-unprotected-regression',
    kind: 'self-notification',
    protected_action: false,
    global_user_id: 'user-quiet-hours-regression',
    project_scope: 'sg2.1',
    group_scope: null,
    thread_scope: null,
    payload: { traceContext: { traceId: 'trace-self-notification-gate', requestId: 'request-self-notification-gate' } },
    attempt: 1,
    idempotency_key: 'idem-self-notification-gate'
  };

  let claimed = false;
  let gateChecks = 0;
  let executions = 0;
  let failedWith = null;
  const queue = {
    async releaseDue() { return []; },
    async recoverAbandoned() { return []; },
    async claim() {
      if (claimed) return null;
      claimed = true;
      return task;
    },
    async heartbeat() { return task; },
    async complete() { throw new Error('executor must not complete deferred self-notification'); },
    async fail({ error }) {
      failedWith = error;
      return { outcome: 'deferred', task: { ...task, status: 'scheduled', available_at: error.deferUntil }, deferUntil: error.deferUntil };
    }
  };

  const worker = createDurableWorker({
    workerId: 'self-notification-gate-regression-worker',
    queue,
    leaseMs: 1000,
    heartbeatMs: 100,
    pollMs: 10,
    actionGate: async (request) => {
      gateChecks += 1;
      assert.equal(request.kind, 'self-notification');
      assert.equal(request.actorGlobalUserId, task.global_user_id);
      return { outcome: 'defer', allowed: false, reason: 'quiet-hours', deferUntil };
    },
    executor: async () => {
      executions += 1;
      return { status: 'completed' };
    }
  });

  const result = await worker.runOnce();
  assert.equal(gateChecks, 1);
  assert.equal(executions, 0);
  assert.equal(result.status, 'scheduled');
  assert.equal(result.available_at, deferUntil);
  assert.equal(failedWith?.code, 'action_gate_deferred');
  assert.equal(failedWith?.deferUntil, deferUntil);
});
