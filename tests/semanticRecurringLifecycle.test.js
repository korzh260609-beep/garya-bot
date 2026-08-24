import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalCapabilities } from '../src/temporal/temporalCapabilities.js';

function request(input) {
  return {
    input,
    actor: { globalUserId: 'usr_owner' },
    scope: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-semantic-recurring', requestId: 'request-semantic-recurring' }
  };
}

function capabilitySet(schedules) {
  const cancelled = [];
  const scheduler = {
    async list() { return schedules; },
    async get({ scheduleId }) { return schedules.find((item) => item.scheduleId === scheduleId) ?? null; },
    async update() { return null; },
    async pause() { return null; },
    async resume() { return null; },
    async cancel({ scheduleId }) {
      cancelled.push(scheduleId);
      const schedule = schedules.find((item) => item.scheduleId === scheduleId);
      return schedule ? { ...schedule, status: 'cancelled' } : null;
    }
  };
  const temporalService = {
    async contextForUser() { return { timezoneKnown: true, timeZone: 'Europe/Kyiv' }; },
    async setUserTimezone() { return {}; },
    isValidTimeZone() { return true; },
    now() { return new Date('2026-08-14T17:00:00.000Z'); }
  };
  const capabilities = createTemporalCapabilities({ temporalService, recurringScheduler: scheduler });
  return { cancel: capabilities.find((item) => item.name === 'schedule-cancel'), cancelled };
}

test('semantic selector cancels only the matching recurring self-notification', async () => {
  const schedules = [
    {
      scheduleId: 'every-three-minutes', taskId: 'task-three', status: 'active',
      recurrence: 'FREQ=MINUTELY;INTERVAL=3', timeZone: 'UTC', dtstartLocal: '2026-08-14T17:03:00',
      state: { notificationMessage: 'привет', localTime: null }
    },
    {
      scheduleId: 'daily-monarch', taskId: 'task-daily', status: 'active',
      recurrence: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-15T07:00:00',
      state: { notificationMessage: 'ПРИВЕТ MONARCH', localTime: '07:00' }
    }
  ];
  const { cancel, cancelled } = capabilitySet(schedules);

  const result = await cancel.execute(request({
    selector: { recurrence: 'FREQ=MINUTELY;INTERVAL=3', notificationMessage: 'привет' }
  }));

  assert.equal(result.status, 'success');
  assert.equal(result.data.schedule.scheduleId, 'every-three-minutes');
  assert.equal(result.data.selectedBy, 'semantic-selector');
  assert.deepEqual(cancelled, ['every-three-minutes']);
});

test('semantic selector can safely identify one legacy recurring schedule without message metadata', async () => {
  const schedules = [
    {
      scheduleId: 'legacy-three-minutes', taskId: 'legacy-task', status: 'active',
      recurrence: 'FREQ=MINUTELY;INTERVAL=3', timeZone: 'UTC', dtstartLocal: '2026-08-14T17:03:00', state: {}
    },
    {
      scheduleId: 'daily-monarch', taskId: 'task-daily', status: 'active',
      recurrence: 'FREQ=DAILY', timeZone: 'Europe/Kyiv', dtstartLocal: '2026-08-15T07:00:00',
      state: { notificationMessage: 'ПРИВЕТ MONARCH', localTime: '07:00' }
    }
  ];
  const { cancel, cancelled } = capabilitySet(schedules);

  const result = await cancel.execute(request({
    selector: { recurrence: 'FREQ=MINUTELY;INTERVAL=3', notificationMessage: 'привет' }
  }));

  assert.equal(result.status, 'success');
  assert.equal(result.data.schedule.scheduleId, 'legacy-three-minutes');
  assert.equal(result.data.selectedBy, 'semantic-selector-legacy-compatible');
  assert.deepEqual(cancelled, ['legacy-three-minutes']);
});

test('semantic selector fails closed when multiple legacy schedules remain compatible', async () => {
  const schedules = [
    {
      scheduleId: 'legacy-three-a', taskId: 'legacy-a', status: 'active',
      recurrence: 'FREQ=MINUTELY;INTERVAL=3', timeZone: 'UTC', dtstartLocal: '2026-08-14T17:03:00', state: {}
    },
    {
      scheduleId: 'legacy-three-b', taskId: 'legacy-b', status: 'active',
      recurrence: 'FREQ=MINUTELY;INTERVAL=3', timeZone: 'UTC', dtstartLocal: '2026-08-14T17:06:00', state: {}
    }
  ];
  const { cancel, cancelled } = capabilitySet(schedules);

  const result = await cancel.execute(request({
    selector: { recurrence: 'FREQ=MINUTELY;INTERVAL=3', notificationMessage: 'привет' }
  }));

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'schedule-selection-required');
  assert.deepEqual(cancelled, []);
});
