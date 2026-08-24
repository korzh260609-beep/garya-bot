import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryMemoryProvider } from '../src/memory/inMemoryMemoryProvider.js';
import { createProductionCapabilities } from '../src/capability/productionCapabilities.js';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createTemporalTaskStore } from '../src/temporal/temporalTaskStore.js';

function executionRequest(input) {
  return {
    input,
    actor: { globalUserId: 'usr_test', roles: ['monarch'], grants: ['capability:task-create'], authenticationLevel: 'verified' },
    scope: { userScope: 'usr_test', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-subdaily-create', requestId: 'request-subdaily-create' }
  };
}

test('task-create accepts a fixed sub-daily recurrence without inventing a wall-clock time', async () => {
  let captured = null;
  const taskStore = {
    async create({ scope, input }) {
      captured = { scope, input };
      return { taskId: 'task-subdaily', status: 'queued', recurringSchedule: { scheduleId: 'schedule-subdaily', nextOccurrenceAt: '2026-08-14T14:52:30.000Z' } };
    },
    async list() { return []; },
    async get() { return null; },
    async cancel() { return null; }
  };
  const capabilities = createProductionCapabilities({ memoryProvider: createInMemoryMemoryProvider(), taskStore });
  const create = capabilities.find((item) => item.name === 'task-create');
  const result = await create.execute(executionRequest({
    kind: 'self-notification',
    notificationMessage: 'привет',
    recurrence: 'FREQ=MINUTELY;INTERVAL=2',
    originTarget: { transport: 'telegram', address: '12345' },
    userInitiatedCanonicalRequest: true,
    locale: 'ru'
  }));

  assert.equal(result.status, 'success');
  assert.equal(captured.input.recurrence, 'FREQ=MINUTELY;INTERVAL=2');
  assert.equal(captured.input.localTime, null);
  assert.equal(captured.input.temporalExpression, null);
  assert.equal(captured.input.kind, 'self-notification');
});

test('sub-daily recurrence without explicit start or timezone anchors first execution one interval after creation', async () => {
  const now = new Date('2026-08-14T14:50:30.000Z');
  const temporalService = createTemporalContextService({ clock: () => now });
  assert.equal(await temporalService.getUserTimezone('usr_test'), null);

  let createdInput = null;
  let registered = null;
  const baseStore = {
    async create({ input }) {
      createdInput = input;
      return { taskId: 'task-subdaily', status: 'queued', runAt: input.runAt, payload: input };
    },
    async list() { return []; },
    async get() { return null; },
    async cancel() { return null; }
  };
  const recurringScheduler = {
    async register(input) {
      registered = input;
      return { scheduleId: 'schedule-subdaily', firstOccurrenceAt: createdInput.runAt, nextOccurrenceAt: createdInput.runAt };
    }
  };
  const store = createTemporalTaskStore({ taskStore: baseStore, temporalService, recurringScheduler });
  const task = await store.create({
    scope: { userScope: 'usr_test', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: { recurrence: 'FREQ=MINUTELY;INTERVAL=2', payload: { message: 'привет' } }
  });

  assert.equal(createdInput.runAt, '2026-08-14T14:52:30.000Z');
  assert.equal(createdInput.temporalExpression, null);
  assert.equal(createdInput.payload.temporal.localDateTime, '2026-08-14T14:52:30');
  assert.equal(createdInput.payload.temporal.timeZone, 'UTC');
  assert.equal(registered.timeZone, 'UTC');
  assert.equal(registered.dtstartLocal, '2026-08-14T14:52:30');
  assert.equal(registered.recurrence, 'FREQ=MINUTELY;INTERVAL=2');
  assert.equal(task.runAt, '2026-08-14T14:52:30.000Z');
});

test('calendar recurrence without a wall-clock or explicit first time remains fail-closed', async () => {
  const temporalService = createTemporalContextService({ clock: () => new Date('2026-08-14T14:50:30.000Z') });
  await temporalService.setUserTimezone('usr_test', 'Europe/Kyiv');
  const baseStore = {
    async create() { throw new Error('must not create'); },
    async list() { return []; },
    async get() { return null; },
    async cancel() { return null; }
  };
  const store = createTemporalTaskStore({ taskStore: baseStore, temporalService, recurringScheduler: { async register() { throw new Error('must not register'); } } });

  await assert.rejects(
    store.create({ scope: { userScope: 'usr_test', projectScope: 'sg2.1', groupScope: null, threadScope: null }, input: { recurrence: 'FREQ=DAILY', payload: { message: 'привет' } } }),
    (error) => error?.code === 'recurrence-start-required'
  );
});
