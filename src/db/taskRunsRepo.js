// src/db/taskRunsRepo.js
import pool from "../../db.js";

/**
 * tryStartTaskRun({ taskId, runKey, meta })
 *
 * Runtime gate + Stage 5.4 retry behavior:
 * - INSERT new run if not exists (status=running, attempts=1)
 * - ON CONFLICT(task_id, run_key):
 *     if existing is failed* AND retry_at <= NOW() -> "consume retry":
 *       set status='running', attempts=attempts+1, clear finished_at + fail fields, clear retry_at
 *       RETURNING id (so caller treats as started)
 *     else -> no update, no return (caller treats as NOT started => dedup skip)
 */
export async function tryStartTaskRun({ taskId, runKey, meta = {} }) {
  if (!taskId) throw new Error("tryStartTaskRun: taskId is required");
  if (!runKey) throw new Error("tryStartTaskRun: runKey is required");

  const res = await pool.query(
    `
    INSERT INTO task_runs (task_id, run_key, status, attempts, meta, started_at)
    VALUES ($1, $2, 'running', 1, $3::jsonb, NOW())
    ON CONFLICT (task_id, run_key) DO UPDATE
      SET
        status = 'running',
        attempts = task_runs.attempts + 1,
        started_at = NOW(),
        finished_at = NULL,

        -- consume retry plan
        retry_at = NULL,

        -- clear last fail fields (new attempt starts clean)
        fail_reason = NULL,
        fail_code = NULL,
        last_error_at = NULL

    WHERE
      task_runs.status LIKE 'failed%'
      AND task_runs.retry_at IS NOT NULL
      AND task_runs.retry_at <= NOW()
    RETURNING id
    `,
    [taskId, runKey, JSON.stringify(meta || {})]
  );

  const runId = res?.rows?.[0]?.id ?? null;
  return { started: Boolean(runId), runId };
}

/**
 * finishTaskRun({ taskId, runKey, status })
 * - marks run as completed/failed-like (but Stage 5.4 uses markTaskRunFailed)
 */
export async function finishTaskRun({ taskId, runKey, status = "completed" }) {
  if (!taskId) throw new Error("finishTaskRun: taskId is required");
  if (!runKey) throw new Error("finishTaskRun: runKey is required");

  await pool.query(
    `
    UPDATE task_runs
    SET status = $3,
        finished_at = NOW()
    WHERE task_id = $1
      AND run_key = $2
    `,
    [taskId, runKey, status]
  );

  return { ok: true };
}

/**
 * getTaskRunAttempts({ taskId, runKey })
 * - returns integer attempts from task_runs
 */
export async function getTaskRunAttempts({ taskId, runKey }) {
  if (!taskId) throw new Error("getTaskRunAttempts: taskId is required");
  if (!runKey) throw new Error("getTaskRunAttempts: runKey is required");

  const res = await pool.query(
    `
    SELECT attempts
    FROM task_runs
    WHERE task_id = $1
      AND run_key = $2
    LIMIT 1
    `,
    [taskId, runKey]
  );

  return res?.rows?.[0]?.attempts ?? null;
}

/**
 * markTaskRunFailed({ taskId, runKey, failReason, failCode, retryAtIso, maxRetries })
 * - writes Stage 5.4 fields into task_runs
 */
export async function markTaskRunFailed({
  taskId,
  runKey,
  failReason = null,
  failCode = null,
  retryAtIso = null,
  maxRetries = null,
}) {
  if (!taskId) throw new Error("markTaskRunFailed: taskId is required");
  if (!runKey) throw new Error("markTaskRunFailed: runKey is required");

  await pool.query(
    `
    UPDATE task_runs
    SET status = 'failed',
        finished_at = NOW(),
        fail_reason = $3,
        fail_code = $4,
        retry_at = $5,
        max_retries = $6,
        last_error_at = NOW()
    WHERE task_id = $1
      AND run_key = $2
    `,
    [
      taskId,
      runKey,
      failReason,
      failCode,
      retryAtIso ? new Date(retryAtIso) : null,
      typeof maxRetries === "number" ? maxRetries : null,
    ]
  );

  return { ok: true };
}
