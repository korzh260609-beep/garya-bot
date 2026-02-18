// src/db/taskRunsRepo.js
import pool from "../../db.js";

/**
 * tryStartTaskRun({ taskId, runKey, meta })
 * - canonical dedup gate using task_runs unique(task_id, run_key)
 * - returns { started: boolean, runId: number|null }
 * - polish:
 *   - if conflict -> attempts = attempts + 1
 *   - if conflict and status='failed' -> status='failed_duplicate'
 */
export async function tryStartTaskRun({ taskId, runKey, meta = {} }) {
  if (!taskId) throw new Error("tryStartTaskRun: taskId is required");
  if (!runKey) throw new Error("tryStartTaskRun: runKey is required");

  const res = await pool.query(
    `
    INSERT INTO task_runs (task_id, run_key, status, attempts, meta, started_at)
    VALUES ($1, $2, 'running', 1, $3::jsonb, NOW())
    ON CONFLICT (task_id, run_key) DO NOTHING
    RETURNING id
    `,
    [taskId, runKey, JSON.stringify(meta || {})]
  );

  const runId = res?.rows?.[0]?.id ?? null;

  if (!runId) {
    // conflict → bump attempts
    await pool.query(
      `
      UPDATE task_runs
      SET attempts = attempts + 1
      WHERE task_id = $1
        AND run_key = $2
      `,
      [taskId, runKey]
    );

    // if original ended as failed, mark that a duplicate retry happened (diagnostics only)
    await pool.query(
      `
      UPDATE task_runs
      SET status = 'failed_duplicate'
      WHERE task_id = $1
        AND run_key = $2
        AND status = 'failed'
      `,
      [taskId, runKey]
    );
  }

  return { started: Boolean(runId), runId };
}

/**
 * finishTaskRun({ taskId, runKey, status })
 * - marks run as completed/failed
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
