import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createRecurrenceEngine } from '../src/temporal/recurrenceEngine.js';
import { createPostgresRecurringScheduler } from '../src/automation/postgresRecurringScheduler.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createPostgresPersistence } from '../src/persistence/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('recurring schedule update changes the existing schedule in-place and survives persistence restart', async () => {
  const suffix = randomUUID();
  const userId = `recurrence-update:${suffix}`;
  const otherUserId = `recurrence-update-other:${suffix}`;
  const templateId = `template-update:${suffix}`;
  const scheduleId = `schedule-update:${suffix}`;
  const scope = { userScope: userId, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const otherScope = { ...scope, userScope: otherUserId };
  const temporalService = createTemporalContextService({ clock: () => new Date('2026-08-08T13:00:00.000Z') });
  const recurrenceEngine = createRecurrenceEngine({ temporalService });

  let persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'recurrence-update-test' });
  await persistence.start();
  try {
    const queue = createPostgresTaskQueue({ database: persistence.database });
    const scheduler = createPostgresRecurringScheduler({
      database: persistence.database,
      recurrenceEngine,
      clock: () => new Date('2026-08-08T13:00:00.000Z')
    });

    await queue.submit({
      taskId: templateId,
      kind: 'self-notification',
      scope: { globalUserId: userId, projectScope: 'sg2.1' },
      payload: { test: true },
      runAt: '2026-08-10T06:00:00.000Z',
      protectedAction: true,
      idempotencyKey: `template-update:${suffix}`
    });
    await scheduler.register({
      scheduleId,
      taskId: templateId,
      recurrence: 'FREQ=WEEKLY;COUNT=4',
      timeZone: 'Europe/Kyiv',
      dtstartLocal: '2026-08-10T09:00:00'
    });

    assert.equal(await scheduler.update({ scope: otherScope, scheduleId, dtstartLocal: '2026-08-10T10:30:00' }), null);

    const updated = await scheduler.update({
      scope,
      scheduleId,
      dtstartLocal: '2026-08-10T10:30:00',
      state: { localTime: '10:30' }
    });
    assert.equal(updated.scheduleId, scheduleId);
    assert.equal(updated.taskId, templateId);
    assert.equal(updated.dtstartLocal, '2026-08-10T10:30:00');
    assert.equal(updated.firstOccurrenceAt, '2026-08-10T07:30:00.000Z');
    assert.equal(updated.nextOccurrenceAt, '2026-08-17T07:30:00.000Z');
    assert.equal(updated.state.localTime, '10:30');

    const tasks = await persistence.database.query('SELECT task_id,available_at FROM tasks WHERE global_user_id=$1 AND project_scope=$2', [userId, 'sg2.1']);
    assert.equal(tasks.rows.length, 1);
    assert.equal(tasks.rows[0].task_id, templateId);
    assert.equal(new Date(tasks.rows[0].available_at).toISOString(), '2026-08-10T07:30:00.000Z');

    const occurrences = await persistence.database.query('SELECT sequence,scheduled_for,local_datetime FROM schedule_occurrences WHERE schedule_id=$1 ORDER BY sequence', [scheduleId]);
    assert.equal(occurrences.rows.length, 1);
    assert.equal(occurrences.rows[0].sequence, 1);
    assert.equal(new Date(occurrences.rows[0].scheduled_for).toISOString(), '2026-08-10T07:30:00.000Z');
    assert.equal(occurrences.rows[0].local_datetime, '2026-08-10T10:30:00');

    assert.equal((await scheduler.list({ scope })).length, 1);

    await persistence.close();
    persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'recurrence-update-restart-test' });
    await persistence.start();
    const restartedScheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine });
    const restored = await restartedScheduler.get({ scope, scheduleId });
    assert.equal(restored.scheduleId, scheduleId);
    assert.equal(restored.taskId, templateId);
    assert.equal(restored.dtstartLocal, '2026-08-10T10:30:00');
    assert.equal(restored.firstOccurrenceAt, '2026-08-10T07:30:00.000Z');
    assert.equal(restored.nextOccurrenceAt, '2026-08-17T07:30:00.000Z');
  } finally {
    try {
      await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
      await persistence.database.query('DELETE FROM users WHERE global_user_id IN ($1,$2)', [userId, otherUserId]);
    } finally {
      await persistence.close();
    }
  }
});
