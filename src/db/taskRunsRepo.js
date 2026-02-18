// src/db/taskRunsRepo.js
import pool from "../../db.js";

/**
 * tryStartTaskRun({ taskId, runKey, meta })
 * - attempts a canonical dedup gate using task_runs unique(task_id, run_key)
 * - returns { started: boolean, runId: number|null }
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
  return { started: Boolean(runId), runId };
}
