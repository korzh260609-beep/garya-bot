import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalCapabilities } from '../src/temporal/temporalCapabilities.js';

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
  const temporalService = {
    async contextForUser() { return {}; },
    async setUserTimezone() { return {}; },
    isValidTimeZone() { return true; },
    now() { return new Date('2026-08-14T10:00:00.000Z'); }
  };
  const capability = createTemporalCapabilities({ temporalService, recurringScheduler })
    .find((item) => item.name === 'schedule-update');

  const result = await capability.execute({
    actor: { globalUserId: 'usr_owner' },
    scope: { userScope: 'usr_owner', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    traceContext: { requestId: 'request-1' },
    input: { scheduleId: 'schedule-1', localTime: '7:00' }
  });

  assert.equal(result.status, 'success');
  assert.equal(updateInput.dtstartLocal, '2026-08-15T07:00:00');
  assert.deepEqual(updateInput.state, { localTime: '07:00' });
});
