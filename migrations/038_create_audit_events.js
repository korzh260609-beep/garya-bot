/* eslint-disable camelcase */

export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable("audit_events", {
    id: "id",
    global_user_id: {
      type: "text",
      notNull: false,
    },
    chat_id: {
      type: "text",
      notNull: false,
    },
    transport: {
      type: "text",
      notNull: true,
      default: "telegram",
    },
    event_type: {
      type: "text",
      notNull: true,
    },
    actor_ref: {
      type: "text",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
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
  });

  pgm.createIndex("audit_events", ["global_user_id", "created_at"], {
    name: "idx_audit_events_global_user_created_at",
  });

  pgm.createIndex("audit_events", ["event_type", "created_at"], {
    name: "idx_audit_events_event_type_created_at",
  });

  pgm.createIndex("audit_events", ["created_at"], {
    name: "idx_audit_events_created_at",
  });
}

export async function down(pgm) {
  pgm.dropIndex("audit_events", ["created_at"], {
    name: "idx_audit_events_created_at",
    ifExists: true,
  });

  pgm.dropIndex("audit_events", ["event_type", "created_at"], {
    name: "idx_audit_events_event_type_created_at",
    ifExists: true,
  });

  pgm.dropIndex("audit_events", ["global_user_id", "created_at"], {
    name: "idx_audit_events_global_user_created_at",
    ifExists: true,
  });

  pgm.dropTable("audit_events", { ifExists: true });
}