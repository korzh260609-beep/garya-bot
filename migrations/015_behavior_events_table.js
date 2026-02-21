// migrations/015_behavior_events_table.js
// STAGE 5.16 — behavior_events (SKELETON) + minimal indexes
// Purpose: log SG behavior observability events (clarification/risk/mode/style).
// Safe for prod: create-only, forward-only.

export async function up(pgm) {
  pgm.createTable("behavior_events", {
    id: "bigserial",
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },

    // identity-first
    global_user_id: { type: "text" }, // e.g. tg:677128443
    chat_id: { type: "text" }, // telegram chat id (string-safe)
    transport: { type: "text", default: "telegram" }, // future-proof

    // event core
    event_type: { type: "text", notNull: true }, // clarification_asked / risk_warning_shown / ...
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },

    schema_version: { type: "int", notNull: true, default: 1 },
  });

  pgm.createIndex("behavior_events", ["created_at"], {
    name: "behavior_events_created_at_idx",
  });

  pgm.createIndex("behavior_events", ["event_type", "created_at"], {
    name: "behavior_events_type_created_at_idx",
  });

  pgm.createIndex("behavior_events", ["global_user_id", "created_at"], {
    name: "behavior_events_user_created_at_idx",
  });
}

export async function down(pgm) {
  // forward-only
}
