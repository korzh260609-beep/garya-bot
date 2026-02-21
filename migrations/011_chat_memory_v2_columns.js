// migrations/011_chat_memory_v2_columns.js
// STAGE 7.2 — chat_memory V2 (SKELETON): add columns + indexes (backward compatible)

export const shorthands = undefined;

export async function up(pgm) {
  // V2 columns (safe for prod)
  pgm.addColumn(
    "chat_memory",
    {
      global_user_id: { type: "text" },
      transport: { type: "text", default: "telegram" },
      metadata: { type: "jsonb", default: pgm.func("'{}'::jsonb") },
      schema_version: { type: "int", notNull: true, default: 2 },
    },
    { ifNotExists: true }
  );

  // indexes
  pgm.createIndex(
    "chat_memory",
    ["chat_id", { name: "created_at", sort: "DESC" }],
    { name: "idx_chat_memory_chat_created_at_desc", ifNotExists: true }
  );

  pgm.createIndex(
    "chat_memory",
    ["global_user_id", { name: "created_at", sort: "DESC" }],
    { name: "idx_chat_memory_global_user_created_at_desc", ifNotExists: true }
  );

  // optional trace in schema_version table (only if table exists)
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (11, 'chat_memory v2 columns + indexes (skeleton)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
