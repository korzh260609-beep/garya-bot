// migrations/031_command_invocations_table.js
// STAGE 6.8.2 — COMMAND IDEMPOTENCY (DB guard)
// Create command_invocations with UNIQUE (transport, chat_id, message_id)

export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable(
    "command_invocations",
    {
      id: "id",
      transport: { type: "text", notNull: true },
      chat_id: { type: "text", notNull: true },
      message_id: { type: "bigint", notNull: true },
      cmd: { type: "text", notNull: true },
      global_user_id: { type: "text" },
      sender_id: { type: "text" },
      metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    },
    { ifNotExists: true }
  );

  // Process-once per webhook message (command path)
  pgm.createIndex("command_invocations", ["transport", "chat_id", "message_id"], {
    name: "uq_command_invocations_transport_chat_message",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex("command_invocations", ["created_at"], {
    name: "idx_command_invocations_created_at",
    ifNotExists: true,
  });

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (31, 'create command_invocations for command idempotency (stage 6.8.2)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
