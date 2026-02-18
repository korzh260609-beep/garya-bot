// migrations/1771348200000_task_runs_skeleton.js
// STAGE 2.8 — task_runs (skeleton) for runtime deduplication + audit trail

export async function up(pgm) {
  pgm.createTable(
    "task_runs",
    {
      id: "bigserial",
      task_id: {
        type: "integer",
        notNull: true,
        references: '"tasks"',
        onDelete: "CASCADE",
      },
      run_key: { type: "text", notNull: true }, // idempotency / dedup key
      status: { type: "text", notNull: true, default: "running" }, // running|ok|fail
      attempts: { type: "integer", notNull: true, default: 0 },
      error: { type: "text" },
      meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      finished_at: { type: "timestamptz" },
    },
    { ifNotExists: true }
  );

  pgm.createIndex("task_runs", ["task_id", "run_key"], {
    name: "idx_task_runs_task_id_run_key_unique",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex(
    "task_runs",
    ["task_id", { name: "started_at", sort: "DESC" }],
    { name: "idx_task_runs_task_id_started_at", ifNotExists: true }
  );

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (11, 'task_runs skeleton for runtime dedup')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only (prod-safe)
}
