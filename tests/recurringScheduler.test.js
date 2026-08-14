import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createRecurrenceEngine, parseRecurrenceRule } from '../src/temporal/recurrenceEngine.js';
import { createPostgresRecurringScheduler } from '../src/automation/postgresRecurringScheduler.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

function engine() {
  const temporalService = createTemporalContextService({ clock: () => new Date('2026-08-08T13:00:00.000Z') });
  return createRecurrenceEngine({ temporalService });
}

test('recurrence parser normalizes complex RRULE fields', () => {
  const rule = parseRecurrenceRule('RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=1MO,-1FR;BYHOUR=9;BYMINUTE=30;COUNT=8');
  assert.equal(rule.freq, 'MONTHLY');
  assert.equal(rule.interval, 2);
  assert.deepEqual(rule.byDay.map((item) => [item.ordinal, item.weekday]), [[1, 'MO'], [-1, 'FR']]);
  assert.deepEqual(rule.byHour, [9]);
  assert.deepEqual(rule.byMinute, [30]);
  assert.equal(rule.count, 8);
});

test('minutely recurrence supports fixed intervals with absolute sequence', async () => {
  const recurrence = engine();
  const rule = parseRecurrenceRule('FREQ=MINUTELY;INTERVAL=2;COUNT=4');
  assert.equal(rule.canonical, 'FREQ=MINUTELY;INTERVAL=2;COUNT=4');
  const items = await recurrence.occurrences({
    rule,
    dtstartLocal: '2026-08-10T17:25:00',
    timeZone: 'Europe/Kyiv',
    limit: 4
  });
  assert.deepEqual(items.map((item) => item.localDateTime), [
    '2026-08-10T17:25:00', '2026-08-10T17:27:00', '2026-08-10T17:29:00', '2026-08-10T17:31:00'
  ]);
  assert.deepEqual(items.map((item) => item.sequence), [1, 2, 3, 4]);
  const rest = await recurrence.occurrences({
    rule,
    dtstartLocal: '2026-08-10T17:25:00',
    timeZone: 'Europe/Kyiv',
    afterUtc: items[1].utcInstant,
    limit: 5
  });
  assert.deepEqual(rest.map((item) => item.sequence), [3, 4]);
});

test('hourly recurrence uses elapsed absolute intervals across DST offset changes', async () => {
  const recurrence = engine();
  const items = await recurrence.occurrences({
    rule: 'FREQ=HOURLY;INTERVAL=2;COUNT=4',
    dtstartLocal: '2026-10-31T22:30:00',
    timeZone: 'America/New_York',
    limit: 4
  });
  assert.deepEqual(items.map((item) => item.utcInstant), [
    '2026-11-01T02:30:00.000Z', '2026-11-01T04:30:00.000Z', '2026-11-01T06:30:00.000Z', '2026-11-01T08:30:00.000Z'
  ]);
});

test('sub-daily recurrence rejects unsupported calendar filters instead of guessing', () => {
  assert.throws(() => parseRecurrenceRule('FREQ=MINUTELY;INTERVAL=2;BYDAY=MO'), /fixed INTERVAL/);
  assert.throws(() => parseRecurrenceRule('FREQ=HOURLY;BYMINUTE=15'), /fixed INTERVAL/);
});

test('weekly recurrence supports multiple weekdays at one local wall clock', async () => {
  const recurrence = engine();
  const items = await recurrence.occurrences({
    rule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4',
    dtstartLocal: '2026-08-10T09:00:00',
    timeZone: 'Europe/Kyiv',
    limit: 4
  });
  assert.deepEqual(items.map((item) => item.localDateTime), [
    '2026-08-10T09:00:00', '2026-08-12T09:00:00', '2026-08-17T09:00:00', '2026-08-19T09:00:00'
  ]);
  assert.deepEqual(items.map((item) => item.sequence), [1, 2, 3, 4]);
});

test('monthly ordinal BYDAY supports last Friday', async () => {
  const recurrence = engine();
  const items = await recurrence.occurrences({
    rule: 'FREQ=MONTHLY;BYDAY=-1FR;COUNT=3',
    dtstartLocal: '2026-08-28T18:00:00',
    timeZone: 'Europe/Kyiv',
    limit: 3
  });
  assert.deepEqual(items.map((item) => item.localDateTime.slice(0, 10)), ['2026-08-28', '2026-09-25', '2026-10-30']);
});

test('local recurring time survives DST offset changes', async () => {
  const recurrence = engine();
  const items = await recurrence.occurrences({
    rule: 'FREQ=DAILY;COUNT=4',
    dtstartLocal: '2026-10-31T09:00:00',
    timeZone: 'America/New_York',
    limit: 4
  });
  assert.deepEqual(items.map((item) => item.localDateTime.slice(11, 16)), ['09:00', '09:00', '09:00', '09:00']);
  assert.equal(items[0].utcInstant, '2026-10-31T13:00:00.000Z');
  assert.equal(items[1].utcInstant, '2026-11-01T14:00:00.000Z');
});

test('COUNT stops the series and afterUtc keeps absolute sequence numbers', async () => {
  const recurrence = engine();
  const first = await recurrence.next({ rule: 'FREQ=DAILY;COUNT=3', dtstartLocal: '2026-08-10T10:00:00', timeZone: 'Europe/Kyiv' });
  const rest = await recurrence.occurrences({ rule: 'FREQ=DAILY;COUNT=3', dtstartLocal: '2026-08-10T10:00:00', timeZone: 'Europe/Kyiv', afterUtc: first.utcInstant, limit: 5 });
  assert.deepEqual(rest.map((item) => item.sequence), [2, 3]);
});

test('ambiguous DST local occurrence remains explicit instead of being guessed', async () => {
  const recurrence = engine();
  const item = await recurrence.next({ rule: 'FREQ=YEARLY;COUNT=1', dtstartLocal: '2026-11-01T01:30:00', timeZone: 'America/New_York' });
  assert.equal(item.status, 'ambiguous');
  assert.equal(item.reason, 'ambiguous-local-time-dst-overlap');
});

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('durable recurring scheduler materializes bounded catch-up exactly once', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'recurrence-test' });
  await persistence.start();
  const suffix = randomUUID();
  const userId = `recurrence:${suffix}`;
  const templateId = `template:${suffix}`;
  const scheduleId = `schedule:${suffix}`;
  const queue = createPostgresTaskQueue({ database: persistence.database });
  const recurrence = engine();
  const scheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine: recurrence });

  try {
    await queue.submit({
      taskId: templateId,
      kind: 'recurring-test',
      scope: { globalUserId: userId, projectScope: 'sg2.1' },
      payload: { test: true },
      runAt: '2026-08-10T06:00:00.000Z',
      maxAttempts: 2,
      idempotencyKey: `template:${suffix}`
    });
    const schedule = await scheduler.register({
      scheduleId,
      taskId: templateId,
      recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3',
      timeZone: 'Europe/Kyiv',
      dtstartLocal: '2026-08-10T09:00:00',
      misfirePolicy: 'catch_up',
      maxCatchup: 2
    });
    assert.equal(schedule.generatedCount, 1);
    assert.equal(schedule.nextOccurrenceAt, '2026-08-12T06:00:00.000Z');

    const materialized = await scheduler.materializeDue({ now: new Date('2026-08-17T07:00:00.000Z') });
    assert.equal(materialized[0].materialized, 2);
    assert.equal(materialized[0].status, 'completed');

    const rows = await persistence.database.query('SELECT task_id,idempotency_key FROM tasks WHERE task_id LIKE $1 ORDER BY task_id', [`schedule:${scheduleId}:%`]);
    assert.deepEqual(rows.rows.map((row) => row.task_id), [`schedule:${scheduleId}:2`, `schedule:${scheduleId}:3`]);
    assert.equal(new Set(rows.rows.map((row) => row.idempotency_key)).size, 2);

    const again = await scheduler.materializeDue({ now: new Date('2026-08-17T08:00:00.000Z') });
    assert.equal(again.length, 0);
    const count = await persistence.database.query('SELECT count(*)::int AS count FROM schedule_occurrences WHERE schedule_id=$1', [scheduleId]);
    assert.equal(count.rows[0].count, 3);
  } finally {
    await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1', [userId]);
    await persistence.close();
  }
});
