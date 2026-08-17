import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWorkflowExecutor } from '../src/automation/workflowExecutor.js';
import { createPostgresWorkflowExecutionStore } from '../src/automation/postgresWorkflowExecutionStore.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

function workflow() {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw216',
    version: 6,
    trigger: { type: 'one-shot', runAt: '2026-08-17T16:00:00.000Z' },
    steps: [
      { type: 'collect', security: { protected: true }, source: { capability: 'workspace-activity' } },
      { type: 'compose', security: { protected: true }, composition: { mode: 'ai-assisted' } },
      { type: 'deliver', security: { protected: true }, delivery: { transport: 'telegram' } }
    ],
    inputs: {},
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3 },
    scope: { globalUserId: 'user:aw216', projectScope: 'sg2.1' },
    createdBy: 'user:aw216', updatedBy: 'user:aw216',
    createdAt: '2026-08-17T15:00:00.000Z', updatedAt: '2026-08-17T15:00:00.000Z',
    provenance: { source: 'test' }
  };
}

function memoryHistoryStore() {
  const runs = [];
  const steps = [];
  const events = [];
  const completions = [];
  return {
    runs, steps, events, completions,
    async startRun(value) { runs.push(structuredClone(value)); },
    async recordStep(value) { steps.push(structuredClone(value)); },
    async recordRunEvent(value) { events.push(structuredClone(value)); },
    async completeRun(value) { completions.push(structuredClone(value)); }
  };
}

test('AW2.16 records one inspectable run with steps, sources, gates, AI cost and delivery result', async () => {
  const store = memoryHistoryStore();
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep({ stepIndex }) {
        return { allowed: true, evaluatedAt: `2026-08-17T16:00:0${stepIndex}.000Z`, evidenceRefs: [`gate:${stepIndex}`] };
      }
    },
    stepHandlers: {
      async collect() {
        return {
          outcome: 'partial',
          output: {
            collectedAt: '2026-08-17T16:00:01.000Z',
            data: { totals: { publications: 2 }, omissions: [{ workspaceId: 'tgw_missing', reason: 'denied' }] },
            sourceMetadata: { capability: 'workspace-activity' }
          },
          evidenceRefs: ['source:workspace']
        };
      },
      async compose() {
        return {
          outcome: 'completed',
          output: {
            message: 'Current activity',
            compositionMetadata: {
              mode: 'ai-assisted',
              ai: { provider: 'openai', model: 'gpt-test', costUsd: 0.002, reason: 'automation-dynamic-composition', traceId: 'trace:aw216', requestId: 'request:aw216', attempts: 1, fallbackUsed: false }
            }
          }
        };
      },
      async deliver() {
        return { outcome: 'completed', output: { status: 'delivered', deliveryId: 'delivery:aw216' }, evidenceRefs: ['delivery:success'] };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw216', workflow: workflow(), occurrenceId: 'occurrence:aw216', attempt: 2,
    traceContext: { traceId: 'trace:aw216', requestId: 'request:aw216' }
  });

  assert.equal(result.runId, 'occurrence:aw216:attempt:2');
  assert.equal(result.occurrenceId, 'occurrence:aw216');
  assert.equal(result.attempt, 2);
  assert.equal(result.outcome, 'partial');
  assert.equal(store.runs.length, 1);
  assert.equal(store.steps.length, 6);
  assert.deepEqual(store.steps.map((entry) => entry.status), ['running', 'partial', 'running', 'completed', 'running', 'completed']);
  assert.equal(store.completions[0].status, 'partial');
  assert.ok(store.events.filter((event) => event.eventType === 'gate-decision').length === 3);
  assert.ok(store.events.some((event) => event.eventType === 'source-result' && event.payload.sourceMetadata.capability === 'workspace-activity'));
  assert.ok(store.events.some((event) => event.eventType === 'ai-call' && event.payload.costUsd === 0.002));
  assert.ok(store.events.some((event) => event.eventType === 'delivery-result' && event.payload.status === 'delivered'));
});

test('AW2.16 closes a thrown execution as failed with error and retry evidence', async () => {
  const store = memoryHistoryStore();
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: { async recheckProtectedStep() { return { allowed: true, evidenceRefs: ['gate:allowed'] }; } },
    stepHandlers: {
      async collect() {
        const error = new Error('provider temporarily unavailable');
        error.code = 'provider_temporarily_unavailable';
        error.retryable = true;
        throw error;
      }
    }
  });
  const oneStep = { ...workflow(), steps: [workflow().steps[0]] };

  await assert.rejects(
    () => executor.execute({ taskId: 'task:aw216:failed', workflow: oneStep, occurrenceId: 'occurrence:aw216:failed', attempt: 1 }),
    /temporarily unavailable/
  );

  assert.equal(store.completions.length, 1);
  assert.equal(store.completions[0].status, 'failed');
  assert.equal(store.completions[0].errorCode, 'provider_temporarily_unavailable');
  assert.equal(store.completions[0].retryable, true);
  assert.equal(store.steps.at(-1).status, 'failed');
});

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('AW2.16 PostgreSQL run history survives store restart with ordered transition evidence', async () => {
  const suffix = randomUUID();
  const taskId = `task:aw216:${suffix}`;
  const runId = `run:aw216:${suffix}`;
  const automationId = `automation:aw216:${suffix}`;
  const scope = { globalUserId: `user:aw216:${suffix}`, projectScope: 'sg2.1' };
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-aw216-history-test' });
  await persistence.start();
  try {
    await persistence.repositories.users.upsert({ globalUserId: scope.globalUserId });
    await persistence.repositories.automation.putTask({ taskId, scope, status: 'queued', payload: {} });
    const store = createPostgresWorkflowExecutionStore({ database: persistence.database });
    await store.startRun({ runId, taskId, automationId, workflowVersion: 1, occurrenceId: `occurrence:${suffix}`, attempt: 1, traceId: suffix, requestId: suffix });
    await store.recordStep({ runId, taskId, automationId, workflowVersion: 1, stepIndex: 0, stepType: 'collect', status: 'running' });
    await store.recordRunEvent({ runId, eventType: 'source-result', stepIndex: 0, payload: { sourceMetadata: { capability: 'test' } }, evidenceRefs: ['source:test'] });
    await store.recordStep({ runId, taskId, automationId, workflowVersion: 1, stepIndex: 0, stepType: 'collect', status: 'completed', output: { value: 1 }, evidenceRefs: ['source:test'] });
    await store.completeRun({ runId, status: 'completed', output: { value: 1 }, evidenceRefs: ['source:test'] });
  } finally {
    await persistence.close();
  }

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-aw216-history-restart-test' });
  await restarted.start();
  try {
    const history = await createPostgresWorkflowExecutionStore({ database: restarted.database }).getRunHistory(runId);
    assert.equal(history.run.status, 'completed');
    assert.equal(history.run.occurrence_id, `occurrence:${suffix}`);
    assert.equal(history.steps.length, 1);
    assert.deepEqual(history.steps[0].output, { value: 1 });
    assert.deepEqual(history.events.map((event) => event.event_type), ['step-running', 'source-result', 'step-completed', 'run-completed']);
  } finally {
    await restarted.close();
  }
});
