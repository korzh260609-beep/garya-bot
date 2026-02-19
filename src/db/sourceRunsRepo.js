// src/db/sourceRunsRepo.js
import pool from "../../db.js";

/**
 * tryStartSourceRun({ sourceKey, runKey, meta })
 * - canonical insert gate using source_runs unique(source_key, run_key)
 * - returns { started: boolean }
 */
export async function tryStartSourceRun({ sourceKey, runKey, meta = {} }) {
  if (!sourceKey) throw new Error("tryStartSourceRun: sourceKey is required");
  if (!runKey) throw new Error("tryStartSourceRun: runKey is required");

  const res = await pool.query(
    `
    INSERT INTO source_runs (source_key, run_key, status, attempts, meta, started_at)
    VALUES ($1, $2, 'running', 1, $3::jsonb, NOW())
    ON CONFLICT (source_key, run_key) DO NOTHING
    RETURNING id
    `,
    [sourceKey, runKey, JSON.stringify(meta || {})]
  );

  const runId = res?.rows?.[0]?.id ?? null;

  if (!runId) {
    // conflict → bump attempts
    await pool.query(
      `
      UPDATE source_runs
      SET attempts = attempts + 1
      WHERE source_key = $1
        AND run_key = $2
      `,
      [sourceKey, runKey]
    );
  }

  return { started: Boolean(runId) };
}

/**
 * finishSourceRun({ sourceKey, runKey, status, error })
 */
export async function finishSourceRun({
  sourceKey,
  runKey,
  status = "ok",
  error = null,
}) {
  if (!sourceKey) throw new Error("finishSourceRun: sourceKey is required");
  if (!runKey) throw new Error("finishSourceRun: runKey is required");

  await pool.query(
    `
    UPDATE source_runs
    SET status = $3,
        error = $4,
        finished_at = NOW()
    WHERE source_key = $1
      AND run_key = $2
    `,
    [sourceKey, runKey, status, error ? String(error).slice(0, 800) : null]
  );

  return { ok: true };
}
