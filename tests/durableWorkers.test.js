import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createDurableWorker } from '../src/automation/durableWorker.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function scope(suffix) {
  return { globalUserId: `worker-user:${suffix}`, projectScope: 'sg2.1', groupScope: null, threadScope: null };
}

async function fixture(name) {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: name });
  await persistence.start();
  const queue = createPostgresTaskQueue({ database: persistence.database });
  return { persistence, queue };
}

integration('Block 13 durable queue supports schedule, approval, cancellation, idempotency and atomic claiming', async () => {
  const suffix = randomUUID();
  const { persistence, queue } = await fixture('sg-block13-queue-test');
  try {
    const scheduled = await queue.submit({ taskId: `scheduled:${suffix}`, kind: 'scheduled-work', scope: scope(suffix), payload: {}, runAt: new Date(Date.now() + 60000).toISOString(), idempotencyKey: `scheduled-idem:${suffix}` });
    const duplicate = await queue.submit({ taskId: `scheduled-duplicate:${suffix}`, kind: 'scheduled-work', scope: scope(suffix), payload: { duplicate: true }, runAt: new Date(Date.now() + 60000).toISOString(), idempotencyKey: `scheduled-idem:${suffix}` });
    assert.equal(duplicate.task_id, scheduled.task_id);
    assert.equal(scheduled.status, 'scheduled');
    assert.equal((await queue.releaseDue()).length, 0);
    await persistence.database.query("UPDATE tasks SET available_at=now()-interval '1 second' WHERE task_id=$1", [scheduled.task_id]);
    assert.equal((await queue.releaseDue()).length, 1);

    const approval = await queue.submit({ taskId: `approval:${suffix}`, kind: 'protected-work', scope: scope(suffix), payload: {}, approvalRequired: true, protectedAction: true });
    assert.equal(approval.status, 'waiting_approval');
    assert.equal((await queue.approve(approval.task_id, 'monarch')).status, 'queued');

    const cancelled = await queue.submit({ taskId: `cancelled:${suffix}`, kind: 'cancelled-work', scope: scope(suffix), payload: {} });
    await queue.cancel(cancelled.task_id, 'monarch_cancelled');

    const [first, second] = await Promise.all([
      queue.claim({ workerId: 'worker-a', leaseMs: 30000 }),
      queue.claim({ workerId: 'worker-b', leaseMs: 30000 })
    ]);
    const claimed = [first, second].filter(Boolean);
    assert.equal(claimed.length, 2);
    assert.ok(claimed.every((task) => task.task_id !== cancelled.task_id));
    assert.equal(new Set(claimed.map((task) => task.task_id)).size, 2);
    for (const task of claimed) {
      await queue.complete({ taskId: task.task_id, workerId: task.lease_owner, result: { testCleanup: true } });
    }
  } finally {
    await persistence.close();
  }
});

integration('Block 13 worker retries with backoff, passes Action Gate and completes only once', async () => {
  const suffix = randomUUID();
  const { persistence, queue } = await fixture('sg-block13-retry-test');
  let executions = 0;
  let gateChecks = 0;
  const events = [];
  try {
    const task = await queue.submit({
      taskId: `retry:${suffix}`,
      kind: 'protected-retry',
      scope: scope(suffix),
      payload: { identityContext: { globalUserId: scope(suffix).globalUserId }, scopeContext: { projectScope: 'sg2.1' }, traceContext: { traceId: suffix, requestId: suffix } },
      protectedAction: true,
      maxAttempts: 3,
      idempotencyKey: `idem:${suffix}`
    });
    const worker = createDurableWorker({
      workerId: 'worker-retry',
      queue,
      leaseMs: 1000,
      heartbeatMs: 100,
      pollMs: 10,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 4,
      actionGate: async () => { gateChecks += 1; return { outcome: 'allow', allowed: true }; },
      executor: async ({ idempotencyKey }) => {
        executions += 1;
        assert.equal(idempotencyKey, `idem:${suffix}`);
        if (executions < 3) throw new Error(`transient-${executions}`);
        return { ok: true };
      },
      observability: { record: (event) => events.push(event), recordFailure: (event) => events.push(event) }
    });

    assert.equal((await worker.runOnce()).status, 'queued');
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await worker.runOnce()).status, 'queued');
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.equal((await worker.runOnce()).status, 'completed');
    assert.equal(executions, 3);
    assert.equal(gateChecks, 3);
    assert.equal(await worker.runOnce(), null);
    assert.equal((await queue.get(task.task_id)).status, 'completed');
    assert.ok(events.some((event) => event.eventClass === 'worker_task_completed'));
  } finally {
    await persistence.close();
  }
});

integration('Block 13 recovers abandoned leases and moves exhausted work to DLQ', async () => {
  const suffix = randomUUID();
  const { persistence, queue } = await fixture('sg-block13-recovery-test');
  try {
    const recoverable = await queue.submit({ taskId: `recover:${suffix}`, kind: 'recoverable', scope: scope(suffix), payload: {}, maxAttempts: 2 });
    const initialClaim = await queue.claim({ workerId: 'crashed-worker', leaseMs: 1 });
    assert.equal(initialClaim.task_id, recoverable.task_id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await queue.recoverAbandoned();
    assert.equal(recovered.find((task) => task.task_id === recoverable.task_id)?.status, 'queued');

    const doomed = await queue.submit({ taskId: `doomed:${suffix}`, kind: 'doomed', scope: scope(`${suffix}:doomed`), payload: {}, maxAttempts: 1 });
    const claimed = await queue.claim({ workerId: 'worker-dlq', leaseMs: 30000 });
    assert.equal(claimed.task_id, recoverable.task_id);
    await queue.complete({ taskId: claimed.task_id, workerId: 'worker-dlq', result: { recovered: true } });
    const doomedClaim = await queue.claim({ workerId: 'worker-dlq', leaseMs: 30000 });
    assert.equal(doomedClaim.task_id, doomed.task_id);
    const failure = await queue.fail({ taskId: doomed.task_id, workerId: 'worker-dlq', error: new Error('permanent'), baseDelayMs: 1, maxDelayMs: 1 });
    assert.equal(failure.outcome, 'dead_letter');
    assert.equal((await queue.get(doomed.task_id)).status, 'dead_letter');
    const deadLetters = await queue.listDeadLetters();
    assert.ok(deadLetters.some((entry) => entry.task_id === doomed.task_id && entry.reason === 'permanent'));
  } finally {
    await persistence.close();
  }
});

integration('Block 13 denied protected work never reaches executor', async () => {
  const suffix = randomUUID();
  const { persistence, queue } = await fixture('sg-block13-gate-test');
  let executions = 0;
  try {
    const task = await queue.submit({ taskId: `denied:${suffix}`, kind: 'denied-protected', scope: scope(suffix), payload: {}, protectedAction: true, maxAttempts: 1 });
    const worker = createDurableWorker({
      workerId: 'worker-denied',
      queue,
      leaseMs: 1000,
      heartbeatMs: 100,
      actionGate: async () => ({ outcome: 'deny', reason: 'permission_missing' }),
      executor: async () => { executions += 1; }
    });
    const result = await worker.runOnce();
    assert.equal(result.status, 'dead_letter');
    assert.equal(executions, 0);
    assert.equal((await queue.get(task.task_id)).status, 'dead_letter');
  } finally {
    await persistence.close();
  }
});
