// migrations/044_add_repo_state_ai_analysis.js

export const up = (pgm) => {
  pgm.createTable("repo_state_ai_analysis", {
    id: "id",
    repo_full_name: { type: "text", notNull: true },
    branch: { type: "text", notNull: true },
    scan_run_id: {
      type: "integer",
      references: "repo_state_scan_runs(id)",
      onDelete: "SET NULL",
    },
    project_map_signature: { type: "text", notNull: true },
    project_map: { type: "jsonb", notNull: true },
    analysis: { type: "jsonb", notNull: true },
    status: { type: "text", notNull: true, default: "active" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    metadata: { type: "jsonb", notNull: true, default: "{}" },
  });

  pgm.createIndex("repo_state_ai_analysis", ["repo_full_name", "branch", "created_at"]);
  pgm.createIndex("repo_state_ai_analysis", ["project_map_signature"]);
};

export const down = (pgm) => {
  pgm.dropTable("repo_state_ai_analysis", { ifExists: true });
};
