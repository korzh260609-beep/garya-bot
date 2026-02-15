// migrations/004_core_tables_v0.js
// 2.9 DB CONSOLIDATION: move core tables creation into migrations (V0)

export async function up(pgm) {
  pgm.createTable(
    "chat_memory",
    {
      id: "serial",
      chat_id: { type: "text", notNull: true },
      role: { type: "text", notNull: true },
      content: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    "users",
    {
      id: "serial",
      chat_id: { type: "text", notNull: true, unique: true },
      tg_user_id: { type: "text" },
      name: { type: "text" },
      role: { type: "text", notNull: true, default: "guest" },
      language: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    "tasks",
    {
      id: "serial",
      user_chat_id: { type: "text", notNull: true },
      title: { type: "text", notNull: true },
      type: { type: "text", notNull: true },
      payload: { type: "jsonb", notNull: true },
      schedule: { type: "text" },
      status: { type: "text", notNull: true, default: "active" },
      last_run: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  // safety column added earlier via 003 (may already exist)
  pgm.addColumn(
    "tasks",
    { task_run_key: { type: "text" } },
    { ifNotExists: true }
  );

  // try to ensure unique exists (may already exist)
  try {
    pgm.addConstraint("tasks", "tasks_task_run_key_unique", { unique: ["task_run_key"] });
  } catch {}

  pgm.createTable(
    "sources",
    {
      id: "serial",
      key: { type: "text", notNull: true, unique: true },
      name: { type: "text", notNull: true },
      type: { type: "text", notNull: true },
      url: { type: "text" },
      is_enabled: { type: "boolean", notNull: true, default: true },
      config: { type: "jsonb", default: "{}::jsonb" },
      last_success_at: { type: "timestamptz" },
      last_error_at: { type: "timestamptz" },
      last_error_message: { type: "text" },
      allowed_roles: { type: "text[]", default: '{ "guest", "citizen", "monarch" }' },
      allowed_plans: { type: "text[]", default: '{ "free", "pro", "vip" }' },
      rate_limit_seconds: { type: "integer", default: 10 },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    "source_cache",
    {
      id: "serial",
      source_key: { type: "text", notNull: true, unique: true },
      cached_json: { type: "jsonb", notNull: true },
      cached_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex("source_cache", ["source_key"], { name: "idx_source_cache_source_key", ifNotExists: true });

  pgm.createTable(
    "source_checks",
    {
      id: "serial",
      source_key: { type: "text", notNull: true },
      status: { type: "text" },
      ok: { type: "boolean", notNull: true },
      http_status: { type: "int" },
      message: { type: "text" },
      meta: { type: "jsonb", default: "{}::jsonb" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "source_checks",
    ["source_key", { name: "created_at", sort: "DESC" }],
    { name: "idx_source_checks_source_key_created_at", ifNotExists: true }
  );
  pgm.createIndex("source_checks", [{ name: "created_at", sort: "DESC" }], { name: "idx_source_checks_created_at", ifNotExists: true });

  pgm.createTable(
    "source_logs",
    {
      id: "serial",
      source_key: { type: "text", notNull: true },
      source_type: { type: "text" },
      http_status: { type: "integer" },
      ok: { type: "boolean", default: false },
      duration_ms: { type: "integer" },
      params: { type: "jsonb" },
      extra: { type: "jsonb" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "source_logs",
    ["source_key", { name: "created_at", sort: "DESC" }],
    { name: "idx_source_logs_source_key_created_at", ifNotExists: true }
  );

  pgm.createTable(
    "interaction_logs",
    {
      id: "serial",
      chat_id: { type: "text", notNull: true },
      task_type: { type: "text", notNull: true },
      ai_cost_level: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "interaction_logs",
    ["chat_id", { name: "created_at", sort: "DESC" }],
    { name: "idx_interaction_logs_chat_created_at", ifNotExists: true }
  );

  // repo index tables
  pgm.createTable(
    "repo_index_snapshots",
    {
      id: "bigserial",
      repo: { type: "text", notNull: true },
      branch: { type: "text", notNull: true },
      commit_sha: { type: "text" },
      stats: { type: "jsonb", default: "{}::jsonb" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    "repo_index_files",
    {
      snapshot_id: { type: "bigint", notNull: true, references: "\"repo_index_snapshots\"", onDelete: "CASCADE" },
      path: { type: "text", notNull: true },
      blob_sha: { type: "text" },
      size: { type: "integer", default: 0 }
    },
    { ifNotExists: true }
  );

  // composite PK (skeleton): may already exist, so keep as best-effort
  try {
    pgm.addConstraint("repo_index_files", "repo_index_files_pk", { primaryKey: ["snapshot_id", "path"] });
  } catch {}

  pgm.createIndex(
    "repo_index_snapshots",
    ["repo", "branch", { name: "created_at", sort: "DESC" }],
    { name: "idx_repo_index_snapshots_repo_branch", ifNotExists: true }
  );

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (4, 'core tables v0 moved to migrations')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy; keep down minimal
}
