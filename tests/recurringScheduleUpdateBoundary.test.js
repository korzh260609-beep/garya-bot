import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalCapabilities } from '../src/temporal/temporalCapabilities.js';

function temporalService() {
  return {
    async contextForUser() { return {}; },
    async setUserTimezone() { return {}; },
    isValidTimeZone() { return true; },
    now() { return new Date('2026-08-14T10:00:00.000Z'); }
  };
}

function request(input = {}) {
  return {
    actor: { globalUserId: 'usr_owner' },
    scope: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { requestId: 'request-1' },
    input
  };
}

test('schedule-update canonicalizes a single-digit local hour before scheduler update', async () => {
  let updateInput = null;
  const recurringScheduler = {
    async list() { return []; },
    async get({ scheduleId }) {
      return scheduleId === 'schedule-1'
        ? { scheduleId, status: 'active', dtstartLocal: '2026-08-15T07:00:00', timeZone: 'Europe/Kyiv' }
        : null;
    },
    async update(input) {
      updateInput = input;
      return { scheduleId: input.scheduleId, status: 'active', dtstartLocal: input.dtstartLocal, nextOccurrenceAt: '2026-08-16T04:00:00.000Z' };
    },
    async pause() { return null; },
    async resume() { return null; },
    async cancel() { return null; }
  };
  const capability = createTemporalCapabilities({ temporalService: temporalService(), recurringScheduler })
    .find((item) => item.name === 'schedule-update');

  const result = await capability.execute(request({ scheduleId: 'schedule-1', localTime: '7:00' }));

  assert.equal(result.status, 'success');
  assert.equal(updateInput.dtstartLocal, '2026-08-15T07:00:00');
  assert.deepEqual(updateInput.state, { localTime: '07:00' });
});

test('schedule-list exposes actionable recurring schedule details instead of only a count', async () => {
  const schedule = {
    scheduleId: 'schedule-1', status: 'active', recurrence: 'FREQ=DAILY',
    dtstartLocal: '2026-08-15T07:00:00', timeZone: 'Europe/Kyiv',
    nextOccurrenceAt: '2026-08-16T04:00:00.000Z', state: { localTime: '07:00', notificationMessage: 'Утреннее напоминание' }
  };
  const recurringScheduler = {
    async list() { return [schedule]; }, async get() { return schedule; }, async update() { return schedule; },
    async pause() { return schedule; }, async resume() { return schedule; }, async cancel() { return schedule; }
  };
  const capability = createTemporalCapabilities({ temporalService: temporalService(), recurringScheduler })
    .find((item) => item.name === 'schedule-list');

  const result = await capability.execute(request({ locale: 'ru', statuses: ['active'] }));

  assert.equal(result.status, 'success');
  assert.equal(result.data.schedules[0].scheduleId, 'schedule-1');
  assert.match(result.data.message, /«Утреннее напоминание»/);
  assert.match(result.data.message, /Расписание: каждый день в 07:00/);
  assert.match(result.data.message, /Часовой пояс: Киев/);
  assert.equal(result.data.message.includes('schedule-1'), false);
  assert.equal(result.data.message.includes('FREQ=DAILY'), false);
  assert.equal(result.data.message.includes('Europe\/Kyiv'), false);
  assert.equal(result.data.message.includes('2026-08-16T04:00:00.000Z'), false);
});

test('schedule controls may infer exactly one eligible schedule but never guess among several', async () => {
  const schedules = [
    { scheduleId: 'schedule-1', status: 'active', recurrence: 'FREQ=DAILY', dtstartLocal: '2026-08-15T07:00:00', timeZone: 'Europe/Kyiv' }
  ];
  let pausedId = null;
  const recurringScheduler = {
    async list() { return schedules; },
    async get({ scheduleId }) { return schedules.find((item) => item.scheduleId === scheduleId) ?? null; },
    async update() { return null; },
    async pause({ scheduleId }) { pausedId = scheduleId; return { ...schedules[0], status: 'paused' }; },
    async resume() { return null; }, async cancel() { return null; }
  };
  const capabilities = createTemporalCapabilities({ temporalService: temporalService(), recurringScheduler });
  const pause = capabilities.find((item) => item.name === 'schedule-pause');

  const inferred = await pause.execute(request());
  assert.equal(inferred.status, 'success');
  assert.equal(inferred.data.inferredScheduleId, true);
  assert.equal(pausedId, 'schedule-1');

  schedules.push({ scheduleId: 'schedule-2', status: 'active', recurrence: 'FREQ=WEEKLY', dtstartLocal: '2026-08-16T09:00:00', timeZone: 'Europe/Kyiv' });
  const ambiguous = await pause.execute(request());
  assert.equal(ambiguous.status, 'failed');
  assert.equal(ambiguous.error.code, 'schedule-selection-required');
  assert.equal(ambiguous.data.schedules.length, 2);
});
