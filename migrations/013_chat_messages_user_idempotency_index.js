// migrations/013_chat_messages_user_idempotency_index.js
// STAGE 7B.7 — IDEMPOTENCY CORE (DB guard)
//
// Goal: process-once for inbound USER messages.
// Add partial UNIQUE index:
//   UNIQUE (transport, chat_id, message_id)
//   WHERE role='user' AND message_id IS NOT NULL
//
// ⚠️ If duplicates already exist, migration will fail with a clear message.

export const shorthands = undefined;

export async function up(pgm) {
  // 1) Precheck: block migration if duplicates exist (safer than silent data edits)
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM chat_messages
        WHERE role = 'user'
          AND message_id IS NOT NULL
        GROUP BY transport, chat_id, message_id
        HAVING COUNT(*) > 1
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'STAGE 7B.7: cannot add UNIQUE index: duplicates exist in chat_messages for role=user (transport, chat_id, message_id). Clean duplicates first.';
      END IF;
    END $$;
  `);

  // 2) Add partial UNIQUE index for inbound user messages
  pgm.createIndex(
    "chat_messages",
    ["transport", "chat_id", "message_id"],
    {
      name: "uq_chat_messages_transport_chat_message_user",
      unique: true,
      ifNotExists: true,
      where: "role = 'user' AND message_id IS NOT NULL",
    }
  );

  // 3) Trace in schema_version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (13, 'add chat_messages partial unique index for user idempotency (stage 7B.7)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
