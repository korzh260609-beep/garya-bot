// migrations/1771348500000_task_runs_retry_fields.js
// STAGE 5.4 — retries / fail-reasons (task_runs)

export async function up(pgm) {
  // Add retry/fail fields idempotently (safe for RUN_MIGRATIONS_ON_BOOT=1)
  pgm.sql(`
    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS fail_reason text,
      ADD COLUMN IF NOT EXISTS fail_code text,
      ADD COLUMN IF NOT EXISTS retry_at timestamptz,
      ADD COLUMN IF NOT EXISTS max_retries integer,
      ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
  `);

  // Helpful indexes for admin commands like /last_errors /task_status later
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_task_runs_last_error_at
      ON task_runs (last_error_at DESC);

    CREATE INDEX IF NOT EXISTS idx_task_runs_retry_at
      ON task_runs (retry_at ASC)
      WHERE retry_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_task_runs_fail_code
      ON task_runs (fail_code);
  `);
}

export async function down() {
  // forward-only
}
