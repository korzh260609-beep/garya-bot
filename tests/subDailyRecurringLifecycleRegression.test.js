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
const fixedNow = new Date('2026-08-14T14:00:00.000Z');

function recurrenceEngine() {
  return createRecurrenceEngine({ temporalService: createTemporalContextService({ clock: () => fixedNow }) });
}

integration('pause resume and cancel control the pending first recurring delivery', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'subdaily-lifecycle-test' });
  await persistence.start();
  const suffix = randomUUID();
  const userId = `subdaily-lifecycle:${suffix}`;
  const templateId = `subdaily-template:${suffix}`;
  const scheduleId = `subdaily-schedule:${suffix}`;
  const scope = { userScope: userId, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const queue = createPostgresTaskQueue({ database: persistence.database });
  const scheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine: recurrenceEngine(), clock: () => fixedNow });

  try {
    await queue.submit({
      taskId: templateId,
      kind: 'self-notification',
      scope: { globalUserId: userId, projectScope: 'sg2.1' },
      payload: { message: 'hello' },
      runAt: '2026-08-14T14:02:00.000Z',
      idempotencyKey: `subdaily-template:${suffix}`
    });
    await scheduler.register({
      scheduleId,
      taskId: templateId,
      recurrence: 'FREQ=MINUTELY;INTERVAL=2',
      timeZone: 'Europe/Kyiv',
      dtstartLocal: '2026-08-14T17:02:00'
    });

    assert.equal((await queue.get(templateId)).status, 'scheduled');
    assert.equal((await scheduler.pause({ scope, scheduleId })).status, 'paused');
    assert.equal((await queue.get(templateId)).status, 'schedule_paused');

    await queue.releaseDue();
    assert.equal((await queue.get(templateId)).status, 'schedule_paused');

    assert.equal((await scheduler.resume({ scope, scheduleId })).status, 'active');
    assert.equal((await queue.get(templateId)).status, 'scheduled');

    assert.equal((await scheduler.pause({ scope, scheduleId })).status, 'paused');
    assert.equal((await scheduler.cancel({ scope, scheduleId })).status, 'cancelled');
    assert.equal((await queue.get(templateId)).status, 'cancelled');
  } finally {
    await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1', [userId]);
    await persistence.close();
  }
});

integration('updating a running sub-daily interval schedules the immediate next interval without a same-day skip', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'subdaily-update-test' });
  await persistence.start();
  const suffix = randomUUID();
  const userId = `subdaily-update:${suffix}`;
  const templateId = `subdaily-update-template:${suffix}`;
  const scheduleId = `subdaily-update-schedule:${suffix}`;
  const scope = { userScope: userId, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const queue = createPostgresTaskQueue({ database: persistence.database });
  const scheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine: recurrenceEngine(), clock: () => fixedNow });

  try {
    await queue.submit({
      taskId: templateId,
      kind: 'self-notification',
      scope: { globalUserId: userId, projectScope: 'sg2.1' },
      payload: { message: 'hello' },
      runAt: '2026-08-14T14:02:00.000Z',
      idempotencyKey: `subdaily-update-template:${suffix}`
    });
    const registered = await scheduler.register({
      scheduleId,
      taskId: templateId,
      recurrence: 'FREQ=MINUTELY;INTERVAL=2',
      timeZone: 'Europe/Kyiv',
      dtstartLocal: '2026-08-14T17:02:00'
    });
    assert.equal(registered.firstOccurrenceAt, '2026-08-14T14:02:00.000Z');

    await persistence.database.query("UPDATE tasks SET status='completed',completed_at=now(),updated_at=now() WHERE task_id=$1", [templateId]);
    const updated = await scheduler.update({ scope, scheduleId, recurrence: 'FREQ=MINUTELY;INTERVAL=3' });

    assert.equal(updated.recurrence, 'FREQ=MINUTELY;INTERVAL=3');
    assert.equal(updated.nextOccurrenceAt, '2026-08-14T14:05:00.000Z');
  } finally {
    await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1', [userId]);
    await persistence.close();
  }
});
