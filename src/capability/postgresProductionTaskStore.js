function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function scopeValues(scope = {}) {
  return [
    required(scope.userScope, 'scope.userScope'),
    required(scope.projectScope, 'scope.projectScope'),
    scope.groupScope ?? null,
    scope.threadScope ?? null
  ];
}

function normalize(row) {
  if (!row) return null;
  return Object.freeze({
    taskId: row.task_id,
    status: row.status,
    kind: row.kind,
    payload: row.payload ?? {},
    result: row.result ?? null,
    lastError: row.last_error ?? null,
    attempt: Number(row.attempt ?? 0),
    maxAttempts: Number(row.max_attempts ?? 0),
    availableAt: row.available_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    cancelledAt: row.status === 'cancelled' ? row.updated_at ?? null : null
  });
}

export function createPostgresProductionTaskStore({ database, taskQueue } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  if (!taskQueue?.submit || !taskQueue?.cancel) throw new TypeError('taskQueue is required');

  async function getScoped({ scope, taskId }) {
    const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
    const result = await database.query(`SELECT * FROM tasks
      WHERE task_id=$1 AND global_user_id=$2 AND project_scope=$3
        AND group_scope IS NOT DISTINCT FROM $4 AND thread_scope IS NOT DISTINCT FROM $5`,
    [required(taskId, 'taskId'), globalUserId, projectScope, groupScope, threadScope]);
    return normalize(result.rows[0] ?? null);
  }

  return Object.freeze({
    database,
    taskQueue,
    async create({ scope, input = {} }) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      const task = await taskQueue.submit({
        taskId: input.taskId,
        kind: input.kind ?? 'user-task',
        scope: { globalUserId, projectScope, groupScope, threadScope },
        payload: input.payload ?? input,
        runAt: input.runAt ?? null,
        approvalRequired: Boolean(input.approvalRequired),
        protectedAction: Boolean(input.protectedAction),
        maxAttempts: Number.isInteger(input.maxAttempts) ? input.maxAttempts : 3,
        idempotencyKey: input.idempotencyKey ?? null
      });
      return normalize(task);
    },

    async list({ scope, limit = 100 }) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 100;
      const result = await database.query(`SELECT * FROM tasks
        WHERE global_user_id=$1 AND project_scope=$2
          AND group_scope IS NOT DISTINCT FROM $3 AND thread_scope IS NOT DISTINCT FROM $4
        ORDER BY created_at DESC, task_id DESC LIMIT $5`,
      [globalUserId, projectScope, groupScope, threadScope, boundedLimit]);
      return Object.freeze(result.rows.map(normalize));
    },

    get: getScoped,

    async cancel({ scope, taskId }) {
      const existing = await getScoped({ scope, taskId });
      if (!existing) return null;
      const cancelled = await taskQueue.cancel(taskId, 'cancelled-by-production-capability');
      return normalize(cancelled);
    }
  });
}
