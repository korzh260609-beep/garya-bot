// migrations/027_chats_tables.js

export const shorthands = undefined;

export async function up(pgm) {
  // Transport-level chats (group/private/channel)
  pgm.createTable("chats", {
    chat_id: { type: "text", primaryKey: true },

    transport: { type: "text", notNull: true, default: "telegram" }, // future-proof
    chat_type: { type: "text" }, // private/group/supergroup/channel
    title: { type: "text" },

    is_active: { type: "boolean", notNull: true, default: true },

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
    last_seen_at: { type: "timestamptz" },
    meta: { type: "jsonb", default: "{}" },
  });

  pgm.createIndex("chats", ["transport"]);
  pgm.createIndex("chats", ["chat_type"]);
  pgm.createIndex("chats", ["last_seen_at"]);

  // Link identity-level user <-> transport chat
  // (Do NOT enforce FK now to avoid breaking existing DB during transition)
  pgm.createTable("user_chat_links", {
    global_user_id: { type: "text", notNull: true },
    chat_id: { type: "text", notNull: true },

    transport: { type: "text", notNull: true, default: "telegram" },

    // Optional: per-chat flags
    is_member: { type: "boolean", notNull: true, default: true },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    last_seen_at: { type: "timestamptz" },

    meta: { type: "jsonb", default: "{}" },
  });

  pgm.addConstraint("user_chat_links", "user_chat_links_pk", {
    primaryKey: ["global_user_id", "chat_id"],
  });

  pgm.createIndex("user_chat_links", ["chat_id"]);
  pgm.createIndex("user_chat_links", ["global_user_id"]);
  pgm.createIndex("user_chat_links", ["last_seen_at"]);
}

export async function down(pgm) {
  pgm.dropTable("user_chat_links");
  pgm.dropTable("chats");
}
