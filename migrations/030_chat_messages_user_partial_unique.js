// migrations/030_chat_messages_user_partial_unique.js
// STAGE 7B.7 — correct partial unique index for user idempotency
//
// Why:
// - src/db/chatMessagesRepo.js uses:
//   ON CONFLICT (transport, chat_id, message_id) WHERE role='user' AND message_id IS NOT NULL
// - DB must have a matching unique index/constraint for that conflict target.
//
// Current 012 created:
//   UNIQUE (transport, chat_id, message_id, role) WHERE message_id IS NOT NULL
// That is NOT the same, and doesn't match the ON CONFLICT target.

export const shorthands = undefined;

export async function up(pgm) {
  // 1) Drop old unique index if present (created in migration 012)
  // Safe: forward-only, but index replacement is OK for correctness.
  pgm.dropIndex("chat_messages", ["transport", "chat_id", "message_id", "role"], {
    name: "uq_chat_messages_transport_chat_message_role",
    ifExists: true,
  });

  // 2) Create correct partial unique index for user-only idempotency
  pgm.createIndex("chat_messages", ["transport", "chat_id", "message_id"], {
    name: "uq_chat_messages_user_idempotency",
    unique: true,
    ifNotExists: true,
    where: "role = 'user' AND message_id IS NOT NULL",
  });

  // 3) Trace
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (30, 'partial unique index for user idempotency (stage 7B.7)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
