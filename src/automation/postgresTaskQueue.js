import { randomUUID } from 'node:crypto';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function scopeValues(scope = {}) {
  return [requiredString(scope.globalUserId, 'scope.globalUserId'), requiredString(scope.projectScope, 'scope.projectScope'), scope.groupScope ?? null, scope.threadScope ?? null];
}

function boundedEvidence(value) {
  const serialized = JSON.stringify(value ?? {});
  return JSON.parse(serialized.length > 8192 ? serialized.slice(0, 8192) : serialized);
}

export function createPostgresTaskQueue({ database, idFactory = randomUUID } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('database is required');
  if (typeof idFactory !== 'function') throw new TypeError('idFactory must be a function');

  async function submit({ taskId = idFactory(), kind, scope, payload = {}, runAt = null, approvalRequired = false, protectedAction = false, maxAttempts = 3, idempotencyKey = null }) {
    const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
    positiveInteger(maxAttempts, 'maxAttempts');
    const status = approvalRequired ? 'waiting_approval' : (runAt && new Date(runAt) > new Date() ? 'scheduled' : 'queued');
    return database.transaction(async (tx) => {
      await tx.query('INSERT INTO users(global_user_id) VALUES ($1) ON CONFLICT DO NOTHING', [globalUserId]);
      const result = await tx.query(`INSERT INTO tasks(task_id,global_user_id,project_scope,group_scope,thread_scope,status,kind,payload,approval_state,max_attempts,available_at,protected_action,idempotency_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,COALESCE($11::timestamptz,now()),$12,$13)
        ON CONFLICT(task_id) DO NOTHING RETURNING *`, [taskId, globalUserId, projectScope, groupScope, threadScope, status, requiredString(kind, 'kind'), JSON.stringify(payload), JSON.stringify({ required: approvalRequired, approved: false }), maxAttempts, runAt, protectedAction, idempotencyKey]);
      if (result.rows[0]) return result.rows[0];
      const existing = await tx.query('SELECT * FROM tasks WHERE task_id=$1', [taskId]);
      return existing.rows[0];
    });
  }

  async function releaseDue(limit = 100) {
    positiveInteger(limit, 'limit');
    const result = await database.query(`UPDATE tasks t SET status='queued',available_at=now(),updated_at=now()
      WHERE task_id IN (SELECT task_id FROM tasks WHERE status='scheduled' AND available_at<=now() ORDER BY available_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING *`, [limit]);
    return result.rows;
  }

  async function approve(taskId, approvedBy) {
    const result = await database.query(`UPDATE tasks SET status='queued',available_at=now(),approval_state=jsonb_build_object('required',true,'approved',true,'approvedBy',$2,'approvedAt',now()),updated_at=now()
      WHERE task_id=$1 AND status='waiting_approval' RETURNING *`, [requiredString(taskId, 'taskId'), requiredString(approvedBy, 'approvedBy')]);
    if (!result.rows[0]) throw new Error('task is not waiting approval');
    return result.rows[0];
  }

  async function cancel(taskId, reason = 'cancelled') {
    const result = await database.query(`UPDATE tasks SET status='cancelled',cancellation_reason=$2,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now()
      WHERE task_id=$1 AND status NOT IN ('completed','cancelled','dead_letter') RETURNING *`, [requiredString(taskId, 'taskId'), String(reason)]);
    return result.rows[0] ?? (await get(taskId));
  }

  async function claim({ workerId, leaseMs = 30000 } = {}) {
    requiredString(workerId, 'workerId');
    positiveInteger(leaseMs, 'leaseMs');
    return database.transaction(async (tx) => {
      const selected = await tx.query(`SELECT task_id FROM tasks
        WHERE status='queued' AND available_at<=now()
        ORDER BY available_at,created_at,task_id
        FOR UPDATE SKIP LOCKED LIMIT 1`);
      if (!selected.rows[0]) return null;
      const result = await tx.query(`UPDATE tasks SET status='running',attempt=attempt+1,lease_owner=$2,lease_expires_at=now()+($3::text||' milliseconds')::interval,heartbeat_at=now(),updated_at=now()
        WHERE task_id=$1 AND status='queued' RETURNING *`, [selected.rows[0].task_id, workerId, leaseMs]);
      return result.rows[0] ?? null;
    });
  }

  async function heartbeat({ taskId, workerId, leaseMs = 30000 }) {
    positiveInteger(leaseMs, 'leaseMs');
    const result = await database.query(`UPDATE tasks SET heartbeat_at=now(),lease_expires_at=now()+($3::text||' milliseconds')::interval,updated_at=now()
      WHERE task_id=$1 AND status='running' AND lease_owner=$2 AND lease_expires_at>now() RETURNING *`, [taskId, workerId, leaseMs]);
    if (!result.rows[0]) throw new Error('task lease is not owned or expired');
    return result.rows[0];
  }

  async function complete({ taskId, workerId, result }) {
    const updated = await database.query(`UPDATE tasks SET status='completed',result=$3::jsonb,last_error=NULL,completed_at=now(),lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now()
      WHERE task_id=$1 AND status='running' AND lease_owner=$2 RETURNING *`, [taskId, workerId, JSON.stringify(result ?? null)]);
    if (!updated.rows[0]) throw new Error('task lease is not owned');
    return updated.rows[0];
  }

  async function fail({ taskId, workerId, error, baseDelayMs = 1000, maxDelayMs = 60000 }) {
    positiveInteger(baseDelayMs, 'baseDelayMs');
    positiveInteger(maxDelayMs, 'maxDelayMs');
    return database.transaction(async (tx) => {
      const current = await tx.query('SELECT * FROM tasks WHERE task_id=$1 FOR UPDATE', [taskId]);
      const task = current.rows[0];
      if (!task || task.status !== 'running' || task.lease_owner !== workerId) throw new Error('task lease is not owned');
      const errorPayload = boundedEvidence({ message: error instanceof Error ? error.message : String(error), code: error?.code ?? null });
      if (task.attempt < task.max_attempts) {
        const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, task.attempt - 1)));
        const retried = await tx.query(`UPDATE tasks SET status='queued',available_at=now()+($3::text||' milliseconds')::interval,last_error=$4::jsonb,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now()
          WHERE task_id=$1 AND lease_owner=$2 RETURNING *`, [taskId, workerId, delay, JSON.stringify(errorPayload)]);
        return { outcome: 'retry', task: retried.rows[0], delayMs: delay };
      }
      const dead = await tx.query(`UPDATE tasks SET status='dead_letter',last_error=$3::jsonb,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now()
        WHERE task_id=$1 AND lease_owner=$2 RETURNING *`, [taskId, workerId, JSON.stringify(errorPayload)]);
      await tx.query(`INSERT INTO dead_letter_tasks(task_id,reason,evidence) VALUES ($1,$2,$3::jsonb)
        ON CONFLICT(task_id) DO UPDATE SET reason=EXCLUDED.reason,evidence=EXCLUDED.evidence`, [taskId, errorPayload.message, JSON.stringify(boundedEvidence({ attempt: task.attempt, maxAttempts: task.max_attempts, kind: task.kind, error: errorPayload }))]);
      return { outcome: 'dead_letter', task: dead.rows[0] };
    });
  }

  async function recoverAbandoned(limit = 100) {
    positiveInteger(limit, 'limit');
    return database.transaction(async (tx) => {
      const expired = await tx.query(`SELECT * FROM tasks WHERE status='running' AND lease_expires_at<=now() ORDER BY lease_expires_at LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
      const recovered = [];
      for (const task of expired.rows) {
        if (task.attempt < task.max_attempts) {
          const result = await tx.query(`UPDATE tasks SET status='queued',available_at=now(),last_error=jsonb_build_object('message','lease_expired'),lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now() WHERE task_id=$1 RETURNING *`, [task.task_id]);
          recovered.push(result.rows[0]);
        } else {
          const result = await tx.query(`UPDATE tasks SET status='dead_letter',last_error=jsonb_build_object('message','lease_expired'),lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now() WHERE task_id=$1 RETURNING *`, [task.task_id]);
          await tx.query(`INSERT INTO dead_letter_tasks(task_id,reason,evidence) VALUES ($1,'lease_expired',$2::jsonb) ON CONFLICT(task_id) DO NOTHING`, [task.task_id, JSON.stringify({ attempt: task.attempt, maxAttempts: task.max_attempts, kind: task.kind })]);
          recovered.push(result.rows[0]);
        }
      }
      return recovered;
    });
  }

  async function get(taskId) {
    const result = await database.query('SELECT * FROM tasks WHERE task_id=$1', [requiredString(taskId, 'taskId')]);
    return result.rows[0] ?? null;
  }

  async function listDeadLetters(limit = 100) {
    positiveInteger(limit, 'limit');
    const result = await database.query('SELECT * FROM dead_letter_tasks ORDER BY created_at DESC LIMIT $1', [limit]);
    return result.rows;
  }

  return Object.freeze({ submit, releaseDue, approve, cancel, claim, heartbeat, complete, fail, recoverAbandoned, get, listDeadLetters });
}
