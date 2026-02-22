/**
 * STAGE 7B.8
 * 016_chat_meta_skeleton
 *
 * Skeleton table for per-chat aggregates.
 * No triggers.
 * No logic.
 * Not used in code yet.
 */

exports.up = async function (pgm) {
  pgm.createTable("chat_meta", {
    id: {
      type: "bigserial",
      primaryKey: true,
    },

    transport: {
      type: "text",
      notNull: true,
    },

    chat_id: {
      type: "text",
      notNull: true,
    },

    // aggregates (future use)
    message_count: {
      type: "integer",
      notNull: true,
      default: 0,
    },

    last_message_at: {
      type: "timestamptz",
      notNull: false,
    },

    last_role: {
      type: "text",
      notNull: false,
    },

    schema_version: {
      type: "integer",
      notNull: true,
      default: 1,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  // index for fast lookup per chat
  pgm.createIndex("chat_meta", ["transport", "chat_id"], {
    unique: true,
    name: "idx_chat_meta_transport_chat",
  });
};

exports.down = async function (pgm) {
  pgm.dropTable("chat_meta");
};
