// migrations/042_project_memory_layer.js
// ============================================================================
// Project Memory Layer column
// Stage: 7A — Project Memory Layer
// Purpose:
// - add first-class DB support for D-018A logical memory layers
// - keep raw_archive, topic_digest, and confirmed memory physically queryable
// - backfill existing rows from structured entry_type semantics
// - forward-only migration policy
// ============================================================================

export async function up(pgm) {
  pgm.addColumns(
    "project_memory",
    {
      layer: { type: "text", notNull: false },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    UPDATE project_memory
    SET layer = CASE
      WHEN entry_type IN ('section_state', 'decision', 'constraint', 'next_step')
        THEN 'confirmed'
      WHEN entry_type IN ('session_summary', 'topic_digest')
        THEN 'topic_digest'
      ELSE 'raw_archive'
    END
    WHERE layer IS NULL;
  `);

  pgm.alterColumn("project_memory", "layer", {
    notNull: true,
    default: "raw_archive",
  });

  pgm.createIndex(
    "project_memory",
    ["project_key", "layer", "is_active", "updated_at"],
    {
      name: "idx_project_memory_layer_lookup",
      ifNotExists: true,
    }
  );

  pgm.sql(
    `INSERT INTO schema_version (version, note)
     VALUES (42, 'project_memory first-class layer field')
     ON CONFLICT (version) DO NOTHING;`
  );
}

export async function down() {
  // forward-only policy
}
