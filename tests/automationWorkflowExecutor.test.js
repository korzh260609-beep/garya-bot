import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowExecutor } from '../src/automation/workflowExecutor.js';

function workflow(steps) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.3:test',
    version: 1,
    trigger: { type: 'one-shot', runAt: '2026-08-17T07:00:00.000Z' },
    steps,
    inputs: { seed: 'value' },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3 },
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

test('AW2.3 executes canonical steps in order with bounded handoff and preserves partial outcome', async () => {
  const store = memoryStore();
  const calls = [];
  const executor = createWorkflowExecutor({
    maxSerializedLength: 256,
    previewLength: 100,
    stepRunStore: store,
    stepHandlers: {
      collect: async ({ handoff }) => {
        calls.push(['collect', handoff]);
        return { outcome: 'completed', output: { payload: 'x'.repeat(500) }, evidenceRefs: ['source:1'] };
      },
      analyze: async ({ handoff }) => {
        calls.push(['analyze', handoff]);
        assert.equal(handoff.previousStep.stepType, 'collect');
        assert.equal(handoff.previousStep.output.truncated, true);
        return { outcome: 'partial', output: { summary: 'partial evidence' }, evidenceRefs: ['source:1'] };
      },
      compose: async ({ handoff }) => {
        calls.push(['compose', handoff]);
        assert.equal(handoff.previousStep.stepType, 'analyze');
        return { outcome: 'completed', output: { text: 'report' }, evidenceRefs: ['source:1'] };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.3:ordered',
    workflow: workflow([{ type: 'collect' }, { type: 'analyze' }, { type: 'compose' }])
  });

  assert.deepEqual(calls.map(([type]) => type), ['collect', 'analyze', 'compose']);
  assert.equal(result.outcome, 'partial');
  assert.deepEqual(result.output, { text: 'report' });
  assert.deepEqual(store.records.map(({ stepIndex, status }) => [stepIndex, status]), [
    [0, 'running'], [0, 'completed'],
    [1, 'running'], [1, 'partial'],
    [2, 'running'], [2, 'completed']
  ]);
});

test('AW2.3 denied is terminal and does not execute following steps', async () => {
  const store = memoryStore();
  let composeCalls = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    stepHandlers: {
      collect: async () => ({ outcome: 'completed', output: { value: 1 } }),
      retrieve: async () => ({ outcome: 'denied', output: null, errorCode: 'authority_denied', errorMessage: 'current authority missing' }),
      compose: async () => {
        composeCalls += 1;
        return { outcome: 'completed', output: { text: 'must not run' } };
      }
    }
  });

  const result = await executor.execute({
    taskId: 'task:aw2.3:denied',
    workflow: workflow([{ type: 'collect' }, { type: 'retrieve' }, { type: 'compose' }])
  });

  assert.equal(result.outcome, 'denied');
  assert.equal(composeCalls, 0);
  assert.deepEqual(store.records.map(({ stepIndex, status }) => [stepIndex, status]), [
    [0, 'running'], [0, 'completed'],
    [1, 'running'], [1, 'denied']
  ]);
});

test('AW2.3 thrown step failure is persisted as failed and rethrown', async () => {
  const store = memoryStore();
  const expected = new Error('provider unavailable');
  expected.code = 'provider_unavailable';
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    stepHandlers: {
      retrieve: async () => { throw expected; }
    }
  });

  await assert.rejects(
    () => executor.execute({ taskId: 'task:aw2.3:failed', workflow: workflow([{ type: 'retrieve' }]) }),
    (error) => error === expected
  );
  assert.deepEqual(store.records.map(({ status }) => status), ['running', 'failed']);
  assert.equal(store.records[1].errorCode, 'provider_unavailable');
  assert.equal(store.records[1].errorMessage, 'provider unavailable');
});
