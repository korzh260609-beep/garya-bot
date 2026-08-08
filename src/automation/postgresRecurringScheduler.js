import { randomUUID } from 'node:crypto';
import { parseRecurrenceRule } from '../temporal/recurrenceEngine.js';

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function validPolicy(value) {
  const policy = value ?? 'fire_once';
  if (!['skip', 'fire_once', 'catch_up'].includes(policy)) throw new TypeError('misfirePolicy must be skip, fire_once or catch_up');
  return policy;
}

function boundedCatchup(value) {
  const number = Number(value ?? 10);
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new TypeError('maxCatchup must be an integer from 1 to 100');
  return number;
}

function taskOccurrenceId(scheduleId, sequence) { return `schedule:${scheduleId}:${sequence}`; }

function normalizedSchedule(row) {
  if (!row) return null;
  return Object.freeze({
    scheduleId: row.schedule_id,
    taskId: row.task_id,
    recurrence: row.recurrence,
    timeZone: row.timezone,
    dtstartLocal: row.dtstart_local,
    status: row.status,
    misfirePolicy: row.misfire_policy,
    maxCatchup: Number(row.max_catchup),
    generatedCount: Number(row.generated_count),
    lastOccurrenceAt: row.last_occurrence_at ? new Date(row.last_occurrence_at).toISOString() : null,
    nextOccurrenceAt: row.next_occurrence_at ? new Date(row.next_occurrence_at).toISOString() : null,
    state: row.state ?? {}
  });
}

export function createPostgresRecurringScheduler({ database, recurrenceEngine, clock = () => new Date(), idFactory = randomUUID } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('database is required');
  if (!recurrenceEngine?.next || !recurrenceEngine?.occurrences) throw new TypeError('recurrenceEngine is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function register({ scheduleId = idFactory(), taskId, recurrence, timeZone, dtstartLocal, misfirePolicy = 'fire_once', maxCatchup = 10, state = {} }) {
    const rule = parseRecurrenceRule(recurrence);
    const policy = validPolicy(misfirePolicy);
    const catchup = boundedCatchup(maxCatchup);
    required(timeZone, 'timeZone');
    required(dtstartLocal, 'dtstartLocal');
    const first = await recurrenceEngine.next({ rule, dtstartLocal, timeZone });
    if (!first || first.status !== 'resolved') throw new Error(`Unable to resolve first recurring occurrence: ${first?.reason ?? 'none'}`);

    return database.transaction(async (tx) => {
      const templateResult = await tx.query('SELECT * FROM tasks WHERE task_id=$1 FOR UPDATE', [required(taskId, 'taskId')]);
      const template = templateResult.rows[0];
      if (!template) throw new Error('recurring schedule template task not found');
      const templateAt = template.available_at ? new Date(template.available_at).toISOString() : null;
      if (templateAt !== first.utcInstant) throw new Error('template task runAt must equal the first recurrence occurrence');

      const next = await recurrenceEngine.next({ rule, dtstartLocal, timeZone, afterUtc: first.utcInstant });
      const completed = !next;
      const result = await tx.query(`INSERT INTO schedules(schedule_id,task_id,due_at,recurrence,state,timezone,dtstart_local,status,misfire_policy,max_catchup,generated_count,last_occurrence_at,next_occurrence_at,completed_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,1,$11,$3,$12)
        ON CONFLICT(schedule_id) DO UPDATE SET recurrence=EXCLUDED.recurrence,state=EXCLUDED.state,timezone=EXCLUDED.timezone,dtstart_local=EXCLUDED.dtstart_local,status=EXCLUDED.status,misfire_policy=EXCLUDED.misfire_policy,max_catchup=EXCLUDED.max_catchup,generated_count=1,last_occurrence_at=EXCLUDED.last_occurrence_at,next_occurrence_at=EXCLUDED.next_occurrence_at,due_at=EXCLUDED.due_at,completed_at=EXCLUDED.completed_at,updated_at=now()
        RETURNING *`, [scheduleId, taskId, next?.utcInstant ?? null, rule.canonical, JSON.stringify(state), timeZone, dtstartLocal, completed ? 'completed' : 'active', policy, catchup, first.utcInstant, completed ? new Date().toISOString() : null]);
      await tx.query(`INSERT INTO schedule_occurrences(schedule_id,sequence,scheduled_for,local_datetime,timezone,task_id)
        VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [scheduleId, first.utcInstant, first.localDateTime, timeZone, taskId]);
      return normalizedSchedule(result.rows[0]);
    });
  }

  async function pause(scheduleId) {
    const result = await database.query("UPDATE schedules SET status='paused',paused_at=now(),updated_at=now() WHERE schedule_id=$1 AND status='active' RETURNING *", [required(scheduleId, 'scheduleId')]);
    return normalizedSchedule(result.rows[0]);
  }
  async function resume(scheduleId) {
    const result = await database.query("UPDATE schedules SET status='active',paused_at=NULL,updated_at=now() WHERE schedule_id=$1 AND status='paused' RETURNING *", [required(scheduleId, 'scheduleId')]);
    return normalizedSchedule(result.rows[0]);
  }
  async function cancel(scheduleId) {
    const result = await database.query("UPDATE schedules SET status='cancelled',updated_at=now() WHERE schedule_id=$1 AND status NOT IN ('completed','cancelled') RETURNING *", [required(scheduleId, 'scheduleId')]);
    return normalizedSchedule(result.rows[0]);
  }
  async function get(scheduleId) {
    const result = await database.query('SELECT * FROM schedules WHERE schedule_id=$1', [required(scheduleId, 'scheduleId')]);
    return normalizedSchedule(result.rows[0]);
  }

  async function materializeOccurrence(tx, schedule, occurrence, now) {
    const templateResult = await tx.query('SELECT * FROM tasks WHERE task_id=$1', [schedule.task_id]);
    const template = templateResult.rows[0];
    if (!template) throw new Error('recurring template task disappeared');
    const taskId = taskOccurrenceId(schedule.schedule_id, occurrence.sequence);
    const approval = template.approval_state ?? {};
    const status = approval.required === true && approval.approved !== true
      ? 'waiting_approval'
      : new Date(occurrence.utcInstant) > now ? 'scheduled' : 'queued';
    const payload = { ...(template.payload ?? {}), recurrence: { scheduleId: schedule.schedule_id, sequence: occurrence.sequence, scheduledFor: occurrence.utcInstant, localDateTime: occurrence.localDateTime, timeZone: schedule.timezone, rule: schedule.recurrence } };
    const inserted = await tx.query(`INSERT INTO tasks(task_id,global_user_id,project_scope,group_scope,thread_scope,status,kind,payload,approval_state,max_attempts,available_at,protected_action,idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING *`, [taskId, template.global_user_id, template.project_scope, template.group_scope, template.thread_scope, status, template.kind, JSON.stringify(payload), JSON.stringify(approval), template.max_attempts ?? 3, occurrence.utcInstant, Boolean(template.protected_action), `recurrence:${schedule.schedule_id}:${occurrence.sequence}`]);
    if (inserted.rows[0]) await tx.query(`INSERT INTO schedule_occurrences(schedule_id,sequence,scheduled_for,local_datetime,timezone,task_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [schedule.schedule_id, occurrence.sequence, occurrence.utcInstant, occurrence.localDateTime, schedule.timezone, taskId]);
    return inserted.rows[0] ?? null;
  }

  async function processLockedSchedule(tx, schedule, now) {
    const rule = parseRecurrenceRule(schedule.recurrence);
    const generatedCount = Number(schedule.generated_count ?? 0);
    const afterUtc = schedule.last_occurrence_at ? new Date(schedule.last_occurrence_at).toISOString() : null;
    const catchupLimit = Math.min(Number(schedule.max_catchup ?? 10), 100);
    const candidates = await recurrenceEngine.occurrences({ rule, dtstartLocal: schedule.dtstart_local, timeZone: schedule.timezone, afterUtc, generatedCount: 0, limit: Math.max(catchupLimit + 1, 2) });
    const resolved = candidates.filter((item) => item.status === 'resolved');
    const ambiguous = candidates.find((item) => item.status !== 'resolved');
    if (ambiguous && resolved.length === 0) {
      await tx.query("UPDATE schedules SET status='error',state=state || $2::jsonb,updated_at=now() WHERE schedule_id=$1", [schedule.schedule_id, JSON.stringify({ temporalError: ambiguous.reason, localDateTime: ambiguous.localDateTime })]);
      return { materialized: 0, status: 'error' };
    }

    const due = resolved.filter((item) => new Date(item.utcInstant) <= now);
    let selected = due;
    if (schedule.misfire_policy === 'skip' && due.length > 1) selected = [];
    if (schedule.misfire_policy === 'fire_once' && due.length > 1) selected = [due[due.length - 1]];
    if (schedule.misfire_policy === 'catch_up') selected = due.slice(0, catchupLimit);

    let materialized = 0;
    for (const occurrence of selected) if (await materializeOccurrence(tx, schedule, occurrence, now)) materialized += 1;

    const consumed = schedule.misfire_policy === 'catch_up'
      ? (selected.length ? selected[selected.length - 1] : null)
      : (due.length ? due[due.length - 1] : null);
    const progressionCount = consumed?.sequence ?? generatedCount;
    const progressionUtc = consumed?.utcInstant ?? afterUtc;
    const next = await recurrenceEngine.next({ rule, dtstartLocal: schedule.dtstart_local, timeZone: schedule.timezone, afterUtc: progressionUtc, generatedCount: 0 });

    if (!next) {
      await tx.query("UPDATE schedules SET status='completed',generated_count=$2,last_occurrence_at=$3,next_occurrence_at=NULL,due_at=NULL,completed_at=now(),updated_at=now() WHERE schedule_id=$1", [schedule.schedule_id, progressionCount, progressionUtc]);
      return { materialized, status: 'completed' };
    }
    if (next.status !== 'resolved') {
      await tx.query("UPDATE schedules SET status='error',generated_count=$2,last_occurrence_at=$3,next_occurrence_at=NULL,state=state || $4::jsonb,updated_at=now() WHERE schedule_id=$1", [schedule.schedule_id, progressionCount, progressionUtc, JSON.stringify({ temporalError: next.reason, localDateTime: next.localDateTime })]);
      return { materialized, status: 'error' };
    }
    await tx.query('UPDATE schedules SET generated_count=$2,last_occurrence_at=$3,next_occurrence_at=$4,due_at=$4,updated_at=now() WHERE schedule_id=$1', [schedule.schedule_id, progressionCount, progressionUtc, next.utcInstant]);
    return { materialized, status: 'active', nextOccurrenceAt: next.utcInstant };
  }

  async function materializeDue({ limit = 100, now = clock() } = {}) {
    const current = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(current.getTime())) throw new TypeError('now must be a valid instant');
    const bounded = Math.max(1, Math.min(Number(limit) || 100, 100));
    return database.transaction(async (tx) => {
      const due = await tx.query(`SELECT * FROM schedules WHERE status='active' AND recurrence IS NOT NULL AND next_occurrence_at IS NOT NULL AND next_occurrence_at <= $1 ORDER BY next_occurrence_at,schedule_id FOR UPDATE SKIP LOCKED LIMIT $2`, [current.toISOString(), bounded]);
      const results = [];
      for (const schedule of due.rows) results.push({ scheduleId: schedule.schedule_id, ...(await processLockedSchedule(tx, schedule, current)) });
      return Object.freeze(results);
    });
  }

  return Object.freeze({ register, pause, resume, cancel, get, materializeDue });
}
