// migrations/022_chat_history_retention_policy_skeleton.js
// STAGE 7B.6
// Retention policy skeleton (no logic yet)
// Forward-only migration

export const up = async (pgm) => {
  pgm.createTable("chat_history_retention_policy", {
    id: {
      type: "serial",
      primaryKey: true,
    },
    guest_retention_days: {
      type: "integer",
      notNull: false,
    },
    citizen_retention_days: {
      type: "integer",
      notNull: false,
    },
    monarch_retention_days: {
      type: "integer",
      notNull: false,
    },
    archive_enabled: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  // Insert single default row
  pgm.sql(`
    INSERT INTO chat_history_retention_policy (
      guest_retention_days,
      citizen_retention_days,
      monarch_retention_days,
      archive_enabled
    )
    VALUES (NULL, NULL, NULL, false);
  `);

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (22, 'chat_history_retention_policy skeleton (stage 7B.6)')
    ON CONFLICT (version) DO NOTHING;
  `);
};

export const down = async () => {
  // forward-only
};
