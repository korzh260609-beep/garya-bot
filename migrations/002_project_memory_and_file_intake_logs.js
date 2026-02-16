// migrations/002_project_memory_and_file_intake_logs.js

export async function up(pgm) {
  // project_memory (same as ensureTables, but via migrations)
  pgm.createTable(
    "project_memory",
    {
      id: "bigserial",
      project_key: { type: "text", notNull: true },
      section: { type: "text", notNull: true },
      title: { type: "text" },
      content: { type: "text", notNull: true },
      tags: { type: "text[]", notNull: true, default: "{}" },
      meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      schema_version: { type: "int", notNull: true, default: 1 },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "project_memory",
    ["project_key", "section", "created_at"],
    { name: "idx_project_memory_key_section_created", ifNotExists: true }
  );

  // file_intake_logs (same as ensureTables)
  pgm.createTable(
    "file_intake_logs",
    {
      id: "bigserial",
      chat_id: { type: "text", notNull: true },
      message_id: { type: "bigint" },
      kind: { type: "text" },
      file_id: { type: "text" },
      file_unique_id: { type: "text" },
      file_name: { type: "text" },
      mime_type: { type: "text" },
      file_size: { type: "bigint" },

      has_text: { type: "boolean", notNull: true, default: false },
      should_call_ai: { type: "boolean", notNull: true, default: false },
      direct_reply: { type: "boolean", notNull: true, default: false },

      processed_text_chars: { type: "int", notNull: true, default: 0 },

      ai_called: { type: "boolean", notNull: true, default: false },
      ai_error: { type: "boolean", notNull: true, default: false },

      meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );

  pgm.createIndex(
    "file_intake_logs",
    [{ name: "chat_id" }, { name: "created_at", sort: "DESC" }],
    { name: "idx_file_intake_logs_chat_created", ifNotExists: true }
  );

  // Human schema version tracking (ROADMAP requirement)
  pgm.sql(
    `INSERT INTO schema_version (version, note)
     VALUES (2, 'add project_memory + file_intake_logs via migrations')
     ON CONFLICT (version) DO NOTHING;`
  );
}

export async function down(pgm) {
  // Prod policy is forward-only; down exists only formally.
  pgm.dropTable("file_intake_logs", { ifExists: true });
  pgm.dropTable("project_memory", { ifExists: true });
}
