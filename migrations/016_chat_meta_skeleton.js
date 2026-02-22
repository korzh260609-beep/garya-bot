/**
 * STAGE 7B.8
 * 016_chat_meta_skeleton
 *
 * Skeleton table for per-chat aggregates.
 * ESM version.
 */

export const up = async (pgm) => {
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

    message_count: {
      type: "integer",
      notNull: true,
      default: 0,
    },

    last_message_at: {
      type: "timestamptz",
    },

    last_role: {
      type: "text",
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

  pgm.createIndex("chat_meta", ["transport", "chat_id"], {
    unique: true,
    name: "idx_chat_meta_transport_chat",
  });
};

export const down = async (pgm) => {
  pgm.dropTable("chat_meta");
};
