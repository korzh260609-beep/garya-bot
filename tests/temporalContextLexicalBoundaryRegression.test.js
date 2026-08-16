import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';

function timezoneStore(timeZone = 'Europe/Kyiv') {
  return Object.freeze({
    async get() { return { timeZone, source: 'test' }; },
    async set(_globalUserId, record) { return record; }
  });
}

test('Temporal Context resolves today when a colon follows the temporal word in natural prose', async () => {
  const temporal = createTemporalContextService({
    clock: () => new Date('2026-08-16T03:32:00.000Z'),
    timezoneStore: timezoneStore()
  });

  const result = await temporal.resolveForUser(
    'usr_test',
    'Покажи аналитику по GARYA_пісочниця за сегодня: сколько было опубликовано сообщений, опросов и тестов.'
  );

  assert.equal(result.status, 'resolved');
  assert.equal(result.precision, 'day');
  assert.equal(result.timeZone, 'Europe/Kyiv');
  assert.equal(result.utcStart, '2026-08-15T21:00:00.000Z');
  assert.equal(result.utcEndExclusive, '2026-08-16T21:00:00.000Z');
  assert.match(result.originalExpression, /за сегодня:/);
});

test('Temporal Context resolves Ukrainian today with a following colon', async () => {
  const temporal = createTemporalContextService({
    clock: () => new Date('2026-08-16T03:32:00.000Z'),
    timezoneStore: timezoneStore()
  });

  const result = await temporal.resolveForUser('usr_test', 'Покажи статистику за сьогодні: публікації та взаємодії.');

  assert.equal(result.status, 'resolved');
  assert.equal(result.precision, 'day');
  assert.equal(result.utcStart, '2026-08-15T21:00:00.000Z');
  assert.equal(result.utcEndExclusive, '2026-08-16T21:00:00.000Z');
});
