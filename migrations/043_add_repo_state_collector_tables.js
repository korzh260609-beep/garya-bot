// migrations/043_add_repo_state_collector_tables.js

export const up = (pgm) => {
  pgm.createTable("repo_state_scan_runs", {
    id: "id",
    repo_full_name: { type: "text", notNull: true },
    branch: { type: "text", notNull: true },
    commit_sha: { type: "text" },
    status: { type: "text", notNull: true, default: "started" },
    trigger_type: { type: "text", notNull: true, default: "manual" },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    finished_at: { type: "timestamptz" },
    files_count: { type: "integer", notNull: true, default: 0 },
    modules_count: { type: "integer", notNull: true, default: 0 },
    dependencies_count: { type: "integer", notNull: true, default: 0 },
    error: { type: "text" },
    metadata: { type: "jsonb", notNull: true, default: "{}" },
  });

  pgm.createTable("repo_state_snapshots", {
    id: "id",
    scan_run_id: {
      type: "integer",
      notNull: true,
      references: "repo_state_scan_runs(id)",
      onDelete: "CASCADE",
    },
    repo_full_name: { type: "text", notNull: true },
    branch: { type: "text", notNull: true },
    commit_sha: { type: "text" },
    snapshot: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("repo_state_modules", {
    id: "id",
    scan_run_id: {
      type: "integer",
      notNull: true,
      references: "repo_state_scan_runs(id)",
      onDelete: "CASCADE",
    },
    module_key: { type: "text", notNull: true },
    module_name: { type: "text", notNull: true },
    root_path: { type: "text", notNull: true },
    files_count: { type: "integer", notNull: true, default: 0 },
    total_size: { type: "bigint", notNull: true, default: 0 },
    metadata: { type: "jsonb", notNull: true, default: "{}" },
  });

  pgm.createTable("repo_state_files", {
    id: "id",
    scan_run_id: {
      type: "integer",
      notNull: true,
      references: "repo_state_scan_runs(id)",
      onDelete: "CASCADE",
    },
    module_key: { type: "text" },
    file_path: { type: "text", notNull: true },
    file_sha: { type: "text" },
    file_size: { type: "bigint" },
    extension: { type: "text" },
    content_loaded: { type: "boolean", notNull: true, default: false },
    content_skipped: { type: "boolean", notNull: true, default: true },
    content_skip_reason: { type: "text" },
    visible_in_repo_map: { type: "boolean", notNull: true, default: true },
    metadata: { type: "jsonb", notNull: true, default: "{}" },
  });

  pgm.createTable("repo_state_dependencies", {
    id: "id",
    scan_run_id: {
      type: "integer",
      notNull: true,
      references: "repo_state_scan_runs(id)",
      onDelete: "CASCADE",
    },
    source_file: { type: "text", notNull: true },
    target_specifier: { type: "text", notNull: true },
    target_file: { type: "text" },
    dependency_type: { type: "text", notNull: true },
    resolved: { type: "boolean", notNull: true, default: false },
    metadata: { type: "jsonb", notNull: true, default: "{}" },
  });

  pgm.createIndex("repo_state_scan_runs", ["repo_full_name", "branch", "started_at"]);
  pgm.createIndex("repo_state_snapshots", ["scan_run_id"]);
  pgm.createIndex("repo_state_modules", ["scan_run_id", "module_key"]);
  pgm.createIndex("repo_state_files", ["scan_run_id", "file_path"]);
  pgm.createIndex("repo_state_dependencies", ["scan_run_id", "source_file"]);
};

export const down = (pgm) => {
  pgm.dropTable("repo_state_dependencies", { ifExists: true });
  pgm.dropTable("repo_state_files", { ifExists: true });
  pgm.dropTable("repo_state_modules", { ifExists: true });
  pgm.dropTable("repo_state_snapshots", { ifExists: true });
  pgm.dropTable("repo_state_scan_runs", { ifExists: true });
};
