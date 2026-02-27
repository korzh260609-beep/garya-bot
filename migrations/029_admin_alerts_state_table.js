// migrations/029_admin_alerts_state_table.js
// STAGE 5.15 — ADMIN ALERTS (SKELETON)
// Purpose: store admin alert cooldown/state to avoid spam.
// Safe for prod: create-only, forward-only.

export async function up(pgm) {
  pgm.createTable("admin_alert_state", {
    alert_key: { type: "text", notNull: true, primaryKey: true },

    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },

    last_sent_at: { type: "timestamptz" },

    // Optional: keep last observed value/context (e.g. db_usage_pct, queue_depth, etc.)
    last_value: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },

    schema_version: { type: "int", notNull: true, default: 1 },
  });

  pgm.createIndex("admin_alert_state", ["last_sent_at"], {
    name: "admin_alert_state_last_sent_at_idx",
  });

  pgm.createIndex("admin_alert_state", ["updated_at"], {
    name: "admin_alert_state_updated_at_idx",
  });
}

export async function down(pgm) {
  // forward-only
}
