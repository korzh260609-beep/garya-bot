// migrations/1771348300000_source_runs_skeleton.js
// STAGE 5.2 — source_runs (skeleton) for observability

export async function up(pgm) {
  pgm.createTable(
    "source_runs",
    {
      id: "bigserial",
      source_key: { type: "text", notNull: true }, // e.g. coingecko:price, rss:xyz
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

  pgm.createIndex("source_runs", ["source_key", "run_key"], {
    name: "idx_source_runs_source_key_run_key_unique",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex(
    "source_runs",
    ["source_key", { name: "started_at", sort: "DESC" }],
    { name: "idx_source_runs_source_key_started_at", ifNotExists: true }
  );

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (12, 'source_runs skeleton for observability')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only (prod-safe)
}
