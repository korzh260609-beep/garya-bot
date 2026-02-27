// src/db/dlqRepo.js
import pool from "../../db.js";

function safeJson(v) {
  try {
    return v == null ? null : JSON.stringify(v);
  } catch {
    return null;
  }
}

export class DlqRepo {
  constructor(db = pool) {
    this.db = db;
  }

  async insertDlq(record) {
    const {
      job_id,
      idempotency_key = null,
      task_id = null,
      run_key = null,
      error,
      job = null,
      context = null,
    } = record;

    // DLQ must be fail-open: never crash workers
    try {
      await this.db.query(
        `
        INSERT INTO dlq_jobs
          (job_id, idempotency_key, task_id, run_key, error, job, context)
        VALUES
          ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
        ON CONFLICT (job_id) DO NOTHING
        `,
        [
          String(job_id),
          idempotency_key ? String(idempotency_key) : null,
          task_id != null ? Number(task_id) : null,
          run_key ? String(run_key) : null,
          String(error || "unknown_error").slice(0, 2000),
          safeJson(job),
          safeJson(context),
        ]
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
