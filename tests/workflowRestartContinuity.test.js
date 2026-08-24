import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRestartContinuousWorkflowExecution,
  deriveWorkflowOccurrenceId,
  workflowDeliveryIdempotencyKey
} from '../src/automation/workflowExecutionContinuity.js';
import { createProductionWorkerExecutor } from '../src/automation/productionWorkerExecution.js';
import { createDeliveryRouter, createDeliveryTransportRegistry, createInMemoryDeliveryStore } from '../src/delivery/deliveryRouter.js';

function workflow(version = 2) {
  return {
    schemaVersion: 1,
    automationId: 'automation:aw217',
    version,
    trigger: { type: 'recurring', recurrence: { rule: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-18T07:00:00' } },
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: `version-${version}` },
    delivery: { transport: 'telegram', target: 'self' },
    executionPolicy: { maxAttempts: 3 },
    scope: { globalUserId: 'user:aw217', projectScope: 'sg2.1' },
    createdBy: 'user:aw217', updatedBy: 'user:aw217',
    createdAt: '2026-08-17T17:00:00.000Z', updatedAt: '2026-08-17T17:00:00.000Z',
    provenance: { source: 'aw2.17-regression' }
  };
}

test('AW2.17 derives one stable occurrence identity for scheduler replay and every retry attempt', () => {
  const recurring = { scheduleId: 'schedule:aw217', sequence: 7, scheduledFor: '2026-08-18T04:00:00.000Z' };
  assert.equal(deriveWorkflowOccurrenceId({ taskId: 'first-id', payload: { recurrence: recurring } }), 'schedule:schedule:aw217:7');
  assert.equal(deriveWorkflowOccurrenceId({ taskId: 'replayed-id', payload: { recurrence: recurring } }), 'schedule:schedule:aw217:7');
  assert.equal(deriveWorkflowOccurrenceId({ taskId: 'task:one-shot', payload: {}, idempotencyKey: 'task-create:42' }), 'idempotency:task-create:42');
  assert.equal(workflowDeliveryIdempotencyKey({ occurrenceId: 'schedule:schedule:aw217:7', stepIndex: 1 }), 'automation-delivery:schedule:schedule:aw217:7:step:1');
});

test('AW2.17 resolves the pinned durable workflow version after restart instead of drifting to latest', async () => {
  const resolved = [];
  const executed = [];
  const workflowStore = {
    async resolveVersion(input) {
      resolved.push(structuredClone(input));
      return { workflow: workflow(input.version) };
    }
  };
  const makeRuntime = () => createRestartContinuousWorkflowExecution({
    workflowStore,
    workflowExecutor: {
      async execute(input) {
        executed.push(structuredClone(input));
        return { outcome: 'completed', workflowVersion: input.workflow.version, occurrenceId: input.occurrenceId };
      }
    }
  });
  const task = {
    taskId: 'schedule:schedule:aw217:7',
    payload: {
      workflow: { automationId: 'automation:aw217', version: 2 },
      recurrence: { scheduleId: 'schedule:aw217', sequence: 7 }
    },
    idempotencyKey: 'recurrence:schedule:aw217:7',
    scope: { globalUserId: 'user:aw217', projectScope: 'sg2.1' }
  };

  await makeRuntime().execute({ ...task, attempt: 1 });
  await makeRuntime().execute({ ...task, attempt: 2 });

  assert.deepEqual(resolved.map((entry) => entry.version), [2, 2]);
  assert.deepEqual(executed.map((entry) => entry.workflow.version), [2, 2]);
  assert.deepEqual(executed.map((entry) => entry.occurrenceId), ['schedule:schedule:aw217:7', 'schedule:schedule:aw217:7']);
  assert.deepEqual(executed.map((entry) => entry.attempt), [1, 2]);
});

test('AW2.17 retries a durable failed delivery with the same occurrence key and never redelivers after success', async () => {
  const providerKeys = [];
  let providerCalls = 0;
  const router = createDeliveryRouter({
    store: createInMemoryDeliveryStore(),
    maxAttempts: 1,
    transportRegistry: createDeliveryTransportRegistry({
      transports: [{
        name: 'telegram',
        async deliver({ request }) {
          providerCalls += 1;
          providerKeys.push(request.idempotencyKey);
          if (providerCalls === 1) {
            const error = new Error('temporary transport failure');
            error.code = 'ETIMEDOUT';
            error.retryable = true;
            throw error;
          }
          return { providerMessageId: 'message:aw217' };
        }
      }]
    })
  });
  const executor = createProductionWorkerExecutor({ deliveryRouter: router });
  const request = {
    taskId: 'schedule:schedule:aw217:7',
    kind: 'self-notification',
    payload: {
      occurrenceId: 'schedule:schedule:aw217:7',
      message: 'Restart-safe notification',
      automation: { source: 'canonical-user-request', capability: 'task-create' },
      delivery: {
        recipientGlobalUserId: 'user:aw217', projectScope: 'sg2.1', originBoundSelfNotification: true,
        originTarget: { transport: 'telegram', address: 'chat:aw217' }
      }
    },
    idempotencyKey: 'recurrence:schedule:aw217:7',
    traceContext: { traceId: 'trace:aw217', requestId: 'request:aw217' },
    scope: { globalUserId: 'user:aw217', projectScope: 'sg2.1' }
  };

  await assert.rejects(() => executor({ ...request, attempt: 1 }), /did not complete/);
  const delivered = await executor({ ...request, attempt: 2 });
  const replayed = await executor({ ...request, attempt: 3 });

  assert.equal(delivered.delivery.status, 'delivered');
  assert.equal(replayed.delivery.status, 'delivered');
  assert.equal(replayed.delivery.duplicate, true);
  assert.equal(providerCalls, 2);
  assert.deepEqual(new Set(providerKeys).size, 1);
  assert.equal(providerKeys[0], workflowDeliveryIdempotencyKey({ occurrenceId: request.payload.occurrenceId }));
});
