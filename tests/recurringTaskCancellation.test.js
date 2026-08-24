import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTaskQueue } from '../src/automation/postgresTaskQueue.js';
import { createPostgresRecurringScheduler } from '../src/automation/postgresRecurringScheduler.js';
import { createPostgresProductionTaskStore } from '../src/capability/postgresProductionTaskStore.js';
import { createTemporalTaskStore } from '../src/temporal/temporalTaskStore.js';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createRecurrenceEngine } from '../src/temporal/recurrenceEngine.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('task cancellation cancels its recurring schedule and suppresses pending/future occurrences', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'recurring-task-cancel-test' });
  await persistence.start();

  const suffix = randomUUID();
  const userId = `recurring-task-cancel:${suffix}`;
  const taskId = `recurring-template:${suffix}`;
  const scheduleId = `recurring-schedule:${suffix}`;
  const childTaskId = `schedule:${scheduleId}:99`;
  const scope = { userScope: userId, projectScope: 'sg2.1', groupScope: null, threadScope: null };
  let now = new Date('2026-08-14T16:00:00.000Z');

  const queue = createPostgresTaskQueue({ database: persistence.database });
  const temporalService = createTemporalContextService({ clock: () => new Date(now) });
  const scheduler = createPostgresRecurringScheduler({
    database: persistence.database,
    recurrenceEngine: createRecurrenceEngine({ temporalService }),
    clock: () => new Date(now)
  });
  const productionStore = createPostgresProductionTaskStore({ database: persistence.database, taskQueue: queue });
  const temporalStore = createTemporalTaskStore({ taskStore: productionStore, temporalService, recurringScheduler: scheduler });

  try {
    const created = await temporalStore.create({
      scope,
      input: {
        taskId,
        scheduleId,
        kind: 'self-notification',
        recurrence: 'FREQ=MINUTELY;INTERVAL=3',
        payload: { message: 'привет' },
        protectedAction: true,
        approvalRequired: false,
        idempotencyKey: `recurring-task-cancel:${suffix}`
      }
    });

    assert.equal(created.taskId, taskId);
    assert.equal(created.recurringSchedule.scheduleId, scheduleId);
    assert.equal(created.recurringSchedule.status, 'active');

    await persistence.database.query(`INSERT INTO tasks(
      task_id,global_user_id,project_scope,group_scope,thread_scope,status,kind,payload,approval_state,max_attempts,available_at,protected_action,idempotency_key
    ) SELECT $1,global_user_id,project_scope,group_scope,thread_scope,'scheduled',kind,payload,approval_state,max_attempts,$2::timestamptz,protected_action,$3
      FROM tasks WHERE task_id=$4`, [childTaskId, '2026-08-14T16:04:00.000Z', `recurring-child:${suffix}`, taskId]);
    await persistence.database.query(`INSERT INTO schedule_occurrences(schedule_id,sequence,scheduled_for,local_datetime,timezone,task_id)
      VALUES ($1,99,$2::timestamptz,$3,'UTC',$4)`, [scheduleId, '2026-08-14T16:04:00.000Z', '2026-08-14T16:04:00', childTaskId]);

    const cancelled = await temporalStore.cancel({ scope, taskId });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.recurringSchedule.status, 'cancelled');
    assert.equal((await scheduler.get({ scope, scheduleId })).status, 'cancelled');

    const child = await persistence.database.query('SELECT status,cancellation_reason FROM tasks WHERE task_id=$1', [childTaskId]);
    assert.equal(child.rows[0].status, 'cancelled');
    assert.equal(child.rows[0].cancellation_reason, 'recurring_schedule_cancelled');

    now = new Date('2026-08-14T16:30:00.000Z');
    const materialized = await scheduler.materializeDue({ now });
    assert.equal(materialized.length, 0);

    const generated = await persistence.database.query(`SELECT COUNT(*)::int AS count FROM tasks
      WHERE global_user_id=$1 AND task_id LIKE $2`, [userId, `schedule:${scheduleId}:%`]);
    assert.equal(generated.rows[0].count, 1);
  } finally {
    await persistence.database.query('DELETE FROM tasks WHERE global_user_id=$1', [userId]);
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1', [userId]);
    await persistence.close();
  }
});
