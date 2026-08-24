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

integration('recurring schedule lifecycle controls are scope-bound', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'recurrence-controls-test' });
  await persistence.start();
  const suffix = randomUUID();
  const userId = `recurrence-controls:${suffix}`;
  const otherUserId = `recurrence-controls-other:${suffix}`;
  const templateId = `template-controls:${suffix}`;
  const scheduleId = `schedule-controls:${suffix}`;
  const scope = { userScope: userId, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  const otherScope = { ...scope, userScope: otherUserId };
  const queue = createPostgresTaskQueue({ database: persistence.database });
  const temporalService = createTemporalContextService({ clock: () => new Date('2026-08-08T13:00:00.000Z') });
  const scheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine: createRecurrenceEngine({ temporalService }) });

  try {
    await queue.submit({
      taskId: templateId,
      kind: 'recurring-controls-test',
      scope: { globalUserId: userId, projectScope: 'sg2.1' },
      payload: { test: true },
      runAt: '2026-08-10T06:00:00.000Z',
      idempotencyKey: `template-controls:${suffix}`
    });
    await scheduler.register({
      scheduleId,
      taskId: templateId,
      recurrence: 'FREQ=WEEKLY;COUNT=4',
      timeZone: 'Europe/Kyiv',
      dtstartLocal: '2026-08-10T09:00:00'
    });

    assert.equal((await scheduler.get({ scope, scheduleId })).status, 'active');
    assert.equal(await scheduler.get({ scope: otherScope, scheduleId }), null);
    assert.equal((await scheduler.list({ scope })).length, 1);
    assert.equal((await scheduler.list({ scope: otherScope })).length, 0);

    assert.equal((await scheduler.pause({ scope, scheduleId })).status, 'paused');
    assert.equal(await scheduler.resume({ scope: otherScope, scheduleId }), null);
    assert.equal((await scheduler.resume({ scope, scheduleId })).status, 'active');
    assert.equal(await scheduler.cancel({ scope: otherScope, scheduleId }), null);
    assert.equal((await scheduler.cancel({ scope, scheduleId })).status, 'cancelled');
  } finally {
    await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id IN ($1,$2)', [userId, otherUserId]);
    await persistence.close();
  }
});
