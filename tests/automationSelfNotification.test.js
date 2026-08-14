import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryRouter, createDeliveryTransportRegistry } from '../src/delivery/deliveryRouter.js';
import { createProductionWorkerActionGate, createProductionWorkerExecutor } from '../src/automation/productionWorkerExecution.js';
import { createTemporalTaskStore } from '../src/temporal/temporalTaskStore.js';

function notificationPayload(overrides = {}) {
  return {
    message: 'ДОБРОЕ УТРО МОНАРХ',
    delivery: {
      originTarget: { transport: 'telegram', address: '100500', threadId: null },
      recipientGlobalUserId: 'usr_owner',
      projectScope: 'sg2.1',
      locale: 'ru',
      originBoundSelfNotification: true,
      ...(overrides.delivery ?? {})
    },
    identityContext: { globalUserId: 'usr_owner', roles: ['monarch'], grants: [] },
    automation: { source: 'canonical-user-request', capability: 'task-create' },
    ...overrides
  };
}

test('Delivery Router allows only exact origin-bound self notification target', async () => {
  const delivered = [];
  const registry = createDeliveryTransportRegistry({ transports: [{
    name: 'telegram',
    async deliver({ request, target }) { delivered.push({ request, target }); return { messageId: 1 }; }
  }] });
  const router = createDeliveryRouter({ transportRegistry: registry });

  const result = await router.route({
    kind: 'notification', actorGlobalUserId: 'usr_owner', recipientGlobalUserId: 'usr_owner', projectScope: 'sg2.1',
    message: 'hello', originTarget: { transport: 'telegram', address: '100500' },
    idempotencyKey: 'self:1', metadata: { originBoundSelfNotification: true }
  });
  assert.equal(result.status, 'delivered');
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].target.address, '100500');

  const denied = await router.route({
    kind: 'notification', actorGlobalUserId: 'usr_owner', recipientGlobalUserId: 'usr_other', projectScope: 'sg2.1',
    message: 'hello', originTarget: { transport: 'telegram', address: '100500' },
    idempotencyKey: 'self:2', metadata: { originBoundSelfNotification: true }
  });
  assert.equal(denied.status, 'failed');
  assert.equal(denied.failureCode, 'cross-user-delivery-not-authorized');
});

test('production worker executes registered self notification through Delivery Router', async () => {
  const calls = [];
  const deliveryRouter = { async route(input) { calls.push(input); return { status: 'delivered', deliveryId: 'd1', attempts: 1 }; } };
  const gate = createProductionWorkerActionGate();
  const payload = notificationPayload();
  const decision = await gate({ kind: 'self-notification', payload, actorGlobalUserId: 'usr_owner', projectScope: 'sg2.1' });
  assert.equal(decision.allowed, true);

  const executor = createProductionWorkerExecutor({ deliveryRouter });
  const result = await executor({
    taskId: 'task-1', kind: 'self-notification', payload, attempt: 1, idempotencyKey: 'task-key',
    traceContext: { traceId: 't', requestId: 'r' }, scope: { globalUserId: 'usr_owner', projectScope: 'sg2.1' }
  });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].message, 'ДОБРОЕ УТРО МОНАРХ');
  assert.equal(calls[0].originTarget.address, '100500');
  assert.equal(calls[0].metadata.originBoundSelfNotification, true);
  assert.equal(calls[0].idempotencyKey, 'automation-delivery:task-1');
});

test('production worker rejects self notification with altered recipient', async () => {
  const gate = createProductionWorkerActionGate();
  const payload = notificationPayload({ delivery: { recipientGlobalUserId: 'usr_other' } });
  const decision = await gate({ kind: 'self-notification', payload, actorGlobalUserId: 'usr_owner', projectScope: 'sg2.1' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'self-notification-recipient-mismatch');
});

test('TemporalTaskStore canonicalizes single-digit recurring local hour before deterministic resolution', async () => {
  const createdInputs = [];
  const taskStore = {
    async create({ input }) { createdInputs.push(input); return { taskId: 'template-1', payload: input.payload, availableAt: input.runAt, status: 'scheduled' }; },
    async list() { return []; }, async get() { return null; }, async cancel() { return null; }
  };
  const temporalService = {
    async contextForUser() { return { timezoneKnown: true, localDate: '2026-08-14', localDateTime: '2026-08-14T14:15:00', timeZone: 'Europe/Kyiv' }; },
    async resolveForUser(_user, expression) {
      assert.equal(expression, '2026-08-15 at 07:00');
      return { status: 'resolved', originalExpression: expression, timeZone: 'Europe/Kyiv', localStart: '2026-08-15T07:00:00', utcStart: '2026-08-15T04:00:00.000Z', utcEndExclusive: null, ambiguous: false, precision: 'minute' };
    }
  };
  const recurringScheduler = {
    async register(input) {
      assert.equal(input.recurrence, 'FREQ=DAILY');
      assert.equal(input.dtstartLocal, '2026-08-15T07:00:00');
      return { scheduleId: 'schedule-1', firstOccurrenceAt: '2026-08-15T04:00:00.000Z', nextOccurrenceAt: '2026-08-16T04:00:00.000Z' };
    }
  };
  const store = createTemporalTaskStore({ taskStore, temporalService, recurringScheduler });
  const task = await store.create({
    scope: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: { kind: 'self-notification', recurrence: 'FREQ=DAILY', localTime: '7:00', payload: { message: 'hello' } }
  });
  assert.equal(createdInputs[0].runAt, '2026-08-15T04:00:00.000Z');
  assert.equal(task.recurringSchedule.scheduleId, 'schedule-1');
});
