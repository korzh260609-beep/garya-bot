// migrations/014_webhook_dedupe_events_table.js
// STAGE 7B.7 — IDEMPOTENCY CORE (OBSERVABILITY)
// Create a dedicated table for webhook dedupe events (retry/duplicate deliveries).
//
// This avoids relying on interaction_logs schema (which may not have "event" column).

export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable(
    "webhook_dedupe_events",
    {
      id: "id",
      transport: { type: "text", notNull: true },
      chat_id: { type: "text", notNull: true },
      message_id: { type: "bigint", notNull: true },
      global_user_id: { type: "text" },
      reason: { type: "text", notNull: true, default: "retry_duplicate" },
      metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    },
    { ifNotExists: true }
  );

  // One dedupe event per (transport, chat_id, message_id)
  pgm.createIndex("webhook_dedupe_events", ["transport", "chat_id", "message_id"], {
    name: "uq_webhook_dedupe_events_transport_chat_message",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex("webhook_dedupe_events", ["created_at"], {
    name: "idx_webhook_dedupe_events_created_at",
    ifNotExists: true,
  });

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (14, 'create webhook_dedupe_events table for dedupe metrics (stage 7B.7)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
