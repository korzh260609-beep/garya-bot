import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalCapabilities } from '../src/temporal/temporalCapabilities.js';

function scheduleListCapability(schedules) {
  const recurringScheduler = {
    async list() { return schedules; },
    async get() { return null; },
    async update() { return null; },
    async pause() { return null; },
    async resume() { return null; },
    async cancel() { return null; }
  };
  const temporalService = {
    async contextForUser() { return { timezoneKnown: true, timeZone: 'Europe/Kyiv' }; },
    async setUserTimezone() { return {}; },
    isValidTimeZone() { return true; },
    now() { return new Date('2026-08-17T18:00:00.000Z'); }
  };
  return createTemporalCapabilities({ temporalService, recurringScheduler })
    .find((capability) => capability.name === 'schedule-list');
}

function request(input = {}) {
  return {
    input,
    actor: { globalUserId: 'usr_owner' },
    scope: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { traceId: 'trace-schedule-presentation', requestId: 'request-schedule-presentation' }
  };
}

const schedules = [
  {
    scheduleId: '6a56e793-461e-4320-9f26-75804013a9fd',
    status: 'active',
    recurrence: 'FREQ=DAILY',
    timeZone: 'Europe/Kyiv',
    dtstartLocal: '2026-08-18T07:00:00',
    nextOccurrenceAt: '2026-08-18T04:00:00.000Z',
    state: { notificationMessage: 'Доброе утро', localTime: '07:00' }
  },
  {
    scheduleId: '7a2d84f5-5205-4c8d-9a14-6f9ca5a03c5b',
    status: 'active',
    recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE',
    timeZone: 'Europe/Kyiv',
    dtstartLocal: '2026-08-19T08:30:00',
    nextOccurrenceAt: '2026-08-19T05:30:00.000Z',
    state: { notificationMessage: 'Отчёт по группам', localTime: '08:30' }
  },
  {
    scheduleId: '848b6352-9597-4084-9876-92111fa4522e',
    status: 'cancelled',
    recurrence: 'FREQ=MINUTELY;INTERVAL=3',
    timeZone: 'UTC',
    dtstartLocal: '2026-08-14T16:55:00',
    nextOccurrenceAt: null,
    state: { notificationMessage: 'Старый тест', localTime: '16:55' }
  }
];

test('schedule list presents active automations as localized user information without internal identifiers', async () => {
  const capability = scheduleListCapability(schedules);
  const result = await capability.execute(request({ locale: 'ru', statuses: ['active'] }));

  assert.equal(result.status, 'success');
  assert.equal(result.data.schedules.length, 2);
  assert.equal(result.data.schedules[0].scheduleId, schedules[0].scheduleId);
  assert.match(result.data.message, /^Активные автоматизации: 2/);
  assert.match(result.data.message, /«Доброе утро»/);
  assert.match(result.data.message, /Статус: активна/);
  assert.match(result.data.message, /Расписание: каждый день в 07:00/);
  assert.match(result.data.message, /Часовой пояс: Киев/);
  assert.match(result.data.message, /Следующий запуск: .*18.*2026.*07:00/);
  assert.match(result.data.message, /Расписание: каждую неделю \(пн, ср\) в 08:30/);
  assert.equal(result.data.message.includes('6a56e793'), false);
  assert.equal(result.data.message.includes('FREQ='), false);
  assert.equal(result.data.message.includes('2026-08-18T04:00:00.000Z'), false);
  assert.equal(result.data.message.includes('Старый тест'), false);
});

test('schedule list keeps cancelled schedules available when no semantic status filter was requested', async () => {
  const capability = scheduleListCapability(schedules);
  const result = await capability.execute(request({ locale: 'uk' }));

  assert.equal(result.data.schedules.length, 3);
  assert.match(result.data.message, /^Ваші автоматизації: 3/);
  assert.match(result.data.message, /«Старый тест»/);
  assert.match(result.data.message, /Статус: скасована/);
  assert.match(result.data.message, /Розклад: кожні 3 хв. о 16:55/);
  assert.equal(result.data.message.includes(schedules[2].scheduleId), false);
  assert.equal(result.data.message.includes('FREQ=MINUTELY'), false);
});

test('schedule list rejects unsupported semantic status filters', async () => {
  const capability = scheduleListCapability(schedules);
  await assert.rejects(
    () => capability.execute(request({ locale: 'ru', statuses: ['deleted'] })),
    /unsupported schedule status/
  );
});
