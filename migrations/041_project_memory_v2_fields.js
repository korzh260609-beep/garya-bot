// migrations/041_project_memory_v2_fields.js

export async function up(pgm) {
  pgm.addColumns(
    "project_memory",
    {
      entry_type: { type: "text", notNull: true, default: "section_state" },
      status: { type: "text", notNull: true, default: "active" },
      source_type: { type: "text", notNull: true, default: "unknown" },
      source_ref: { type: "text" },
      related_paths: { type: "text[]", notNull: true, default: "{}" },
      module_key: { type: "text" },
      stage_key: { type: "text" },
      confidence: { type: "real", notNull: true, default: 0.7 },
      is_active: { type: "boolean", notNull: true, default: true },
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "project_memory",
    ["project_key", "section", "entry_type", "is_active", "updated_at"],
    {
      name: "idx_project_memory_v2_lookup",
      ifNotExists: true,
    }
  );

  pgm.createIndex(
    "project_memory",
    ["project_key", "module_key", "stage_key", "updated_at"],
    {
      name: "idx_project_memory_v2_module_stage",
      ifNotExists: true,
    }
  );

  pgm.sql(
    `INSERT INTO schema_version (version, note)
     VALUES (41, 'project_memory v2 structured fields')
     ON CONFLICT (version) DO NOTHING;`
  );
}

export async function down() {
  // forward-only policy
}