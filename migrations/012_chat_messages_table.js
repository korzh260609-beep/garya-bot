// migrations/012_chat_messages_table.js
// STAGE 7B.1 — Chat History (SKELETON): create chat_messages table + базовые индексы
//
// Цель: отдельный "полный лог" сообщений (не заменяет chat_memory).
// Важно: без удаления/изменения chat_memory, forward-only.

export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable(
    "chat_messages",
    {
      id: "bigserial",

      // identity / routing
      transport: { type: "text", notNull: true, default: "telegram" },
      chat_id: { type: "text", notNull: true }, // telegram chat id as text
      chat_type: { type: "text" }, // private/group/supergroup/channel (optional)
      thread_id: { type: "text" }, // future: topics/threading

      // who
      global_user_id: { type: "text" }, // sender identity (for user msgs); for assistant may be null
      sender_id: { type: "text" }, // raw transport sender id (telegram user id), optional

      // msg identity (for idempotency later)
      message_id: { type: "bigint" }, // telegram message_id (can be null for synthetic/system)

      // content
      role: { type: "text", notNull: true }, // user | assistant | system
      content: { type: "text", notNull: true },

      // metadata / raw
      metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      raw: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },

      // lifecycle
      is_redacted: { type: "boolean", notNull: true, default: false },
      schema_version: { type: "int", notNull: true, default: 1 },

      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    },
    { ifNotExists: true }
  );

  // базовые индексы (7B.2.x skeleton)
  pgm.createIndex(
    "chat_messages",
    ["chat_id", { name: "created_at", sort: "DESC" }],
    { name: "idx_chat_messages_chat_created_at_desc", ifNotExists: true }
  );

  pgm.createIndex(
    "chat_messages",
    ["global_user_id", { name: "created_at", sort: "DESC" }],
    { name: "idx_chat_messages_global_user_created_at_desc", ifNotExists: true }
  );

  pgm.createIndex(
    "chat_messages",
    ["transport", "chat_id", { name: "message_id" }],
    { name: "idx_chat_messages_transport_chat_message_id", ifNotExists: true }
  );

  // ⚠️ Уникальность (зачаток idempotency):
  // не жёстко для всех, а только когда message_id есть.
  // Это не полный 7B.7, но защищает от очевидного дубля на уровне БД.
  pgm.createIndex(
    "chat_messages",
    ["transport", "chat_id", "message_id", "role"],
    {
      name: "uq_chat_messages_transport_chat_message_role",
      unique: true,
      ifNotExists: true,
      where: "message_id IS NOT NULL",
    }
  );

  // trace in schema_version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (12, 'create chat_messages table (stage 7B skeleton)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only policy
}
