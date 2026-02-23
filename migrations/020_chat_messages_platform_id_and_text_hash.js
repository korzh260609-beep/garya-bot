// migrations/020_chat_messages_platform_id_and_text_hash.js
// STAGE 7B.2.2 + 7B.2.3
// Add platform_message_id + text_hash
// Add proper unique + hash indexes
// Forward-only migration (safe for prod)

export const up = async (pgm) => {
  // 1️⃣ Add new columns
  pgm.addColumns("chat_messages", {
    platform_message_id: {
      type: "bigint",
    },
    text_hash: {
      type: "text",
    },
  });

  // 2️⃣ Unique index for platform message id
  pgm.createIndex(
    "chat_messages",
    ["chat_id", "platform_message_id"],
    {
      name: "uq_chat_messages_chat_platform_message_id",
      unique: true,
      ifNotExists: true,
      where: "platform_message_id IS NOT NULL",
    }
  );

  // 3️⃣ Hash index for dedupe by content
  pgm.createIndex(
    "chat_messages",
    ["chat_id", "text_hash"],
    {
      name: "idx_chat_messages_chat_text_hash",
      ifNotExists: true,
      where: "text_hash IS NOT NULL",
    }
  );

  // 4️⃣ Trace schema version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (20, 'chat_messages: add platform_message_id + text_hash indexes (stage 7B.2)')
    ON CONFLICT (version) DO NOTHING;
  `);
};

export const down = async () => {
  // forward-only
};
