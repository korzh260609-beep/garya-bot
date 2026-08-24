import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowExecutor } from '../src/automation/workflowExecutor.js';
import { createRuntimeFreshDataCollectHandler } from '../src/automation/runtimeFreshDataCollection.js';

function workflow() {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw2.11:fresh-data',
    version: 1,
    trigger: { type: 'one-shot', runAt: '2026-08-17T07:00:00.000Z' },
    steps: [{
      type: 'collect',
      security: { protected: true },
      source: { capability: 'test-current-data' }
    }],
    inputs: { preparedText: 'STALE PREPARED TEXT MUST NOT BECOME CURRENT EVIDENCE' },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3 },
    scope: { globalUserId: 'user:aw2.11', projectScope: 'sg2.1' },
    createdBy: 'user:aw2.11',
    updatedBy: 'user:aw2.11',
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

test('AW2.11 fresh-data handler fails closed without collect + protected + current security', async () => {
  const handler = createRuntimeFreshDataCollectHandler({
    collectCurrent: async () => ({ data: { current: true } })
  });

  await assert.rejects(
    () => handler({ step: { type: 'retrieve', security: { protected: true } }, securityVerdict: { allowed: true } }),
    (error) => error.code === 'fresh_data_step_type_invalid'
  );
  await assert.rejects(
    () => handler({ step: { type: 'collect' }, securityVerdict: { allowed: true } }),
    (error) => error.code === 'fresh_data_security_required'
  );
  await assert.rejects(
    () => handler({ step: { type: 'collect', security: { protected: true } }, securityVerdict: { allowed: false } }),
    (error) => error.code === 'fresh_data_security_not_current'
  );
});

test('AW2.11 collector receives only current execution context, not stored inputs or prior handoff', async () => {
  let collectorContext = null;
  const handler = createRuntimeFreshDataCollectHandler({
    clock: () => '2026-08-17T06:30:00.000Z',
    collectCurrent: async (context) => {
      collectorContext = context;
      return {
        data: { value: 'fresh' },
        sourceMetadata: { source: 'current-test-source' },
        evidenceRefs: ['source:fresh:1']
      };
    }
  });

  const result = await handler({
    taskId: 'task:aw2.11:context',
    workflow: workflow(),
    step: workflow().steps[0],
    stepIndex: 0,
    handoff: { workflowInputs: { preparedText: 'stale' }, previousStep: { output: 'stale' } },
    securityVerdict: { allowed: true, evidenceRefs: ['security:current'] },
    traceContext: { traceId: 'trace:aw2.11' }
  });

  assert.equal('handoff' in collectorContext, false);
  assert.equal('inputs' in collectorContext, false);
  assert.equal(collectorContext.scope.globalUserId, 'user:aw2.11');
  assert.equal(collectorContext.securityVerdict.allowed, true);
  assert.deepEqual(result, {
    outcome: 'completed',
    output: {
      collectedAt: '2026-08-17T06:30:00.000Z',
      data: { value: 'fresh' },
      sourceMetadata: { source: 'current-test-source' }
    },
    evidenceRefs: ['source:fresh:1'],
    errorCode: null,
    errorMessage: null
  });
});

test('AW2.11 repeated workflow runs recheck security and recollect current evidence every time', async () => {
  const store = memoryStore();
  let securityCalls = 0;
  let collectorCalls = 0;
  let clockCalls = 0;
  const handler = createRuntimeFreshDataCollectHandler({
    clock: () => `2026-08-17T06:3${clockCalls++}:00.000Z`,
    collectCurrent: async (context) => {
      collectorCalls += 1;
      assert.equal('handoff' in context, false);
      assert.equal('inputs' in context, false);
      return {
        data: { currentValue: `fresh-${collectorCalls}` },
        evidenceRefs: [`source:fresh:${collectorCalls}`]
      };
    }
  });
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep() {
        securityCalls += 1;
        return {
          allowed: true,
          evidenceRefs: [`security:fresh:${securityCalls}`]
        };
      }
    },
    stepHandlers: { collect: handler }
  });
  const definition = workflow();

  const first = await executor.execute({ taskId: 'task:aw2.11:first', workflow: definition });
  const second = await executor.execute({ taskId: 'task:aw2.11:second', workflow: definition });

  assert.equal(securityCalls, 2);
  assert.equal(collectorCalls, 2);
  assert.equal(first.output.data.currentValue, 'fresh-1');
  assert.equal(second.output.data.currentValue, 'fresh-2');
  assert.equal(first.output.collectedAt, '2026-08-17T06:30:00.000Z');
  assert.equal(second.output.collectedAt, '2026-08-17T06:31:00.000Z');
  assert.deepEqual(first.evidenceRefs, ['security:fresh:1', 'source:fresh:1']);
  assert.deepEqual(second.evidenceRefs, ['security:fresh:2', 'source:fresh:2']);
});

test('AW2.11 revoked execution-time authority prevents collection entirely', async () => {
  const store = memoryStore();
  let collectorCalls = 0;
  const executor = createWorkflowExecutor({
    stepRunStore: store,
    executionSecurity: {
      async recheckProtectedStep() {
        return { allowed: false, reason: 'resource-authority-revoked', evidenceRefs: ['authority:revoked'] };
      }
    },
    stepHandlers: {
      collect: createRuntimeFreshDataCollectHandler({
        collectCurrent: async () => {
          collectorCalls += 1;
          return { data: { forbidden: true } };
        }
      })
    }
  });

  const result = await executor.execute({ taskId: 'task:aw2.11:revoked', workflow: workflow() });

  assert.equal(result.outcome, 'denied');
  assert.equal(collectorCalls, 0);
  assert.deepEqual(result.evidenceRefs, ['authority:revoked']);
  assert.deepEqual(store.records.map(({ status }) => status), ['running', 'denied']);
});
