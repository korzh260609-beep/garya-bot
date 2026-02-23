// migrations/021_chat_meta_alias_required_when_source_enabled.js
// STAGE 7B.8.2
// Enforce: if source_enabled = true → alias must be non-empty
// Forward-only migration

export const up = async (pgm) => {
  pgm.addConstraint(
    "chat_meta",
    "chk_chat_meta_alias_required_when_source_enabled",
    {
      check: `
        source_enabled = false
        OR (alias IS NOT NULL AND alias <> '')
      `,
    }
  );

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (21, 'chat_meta: require alias when source_enabled=true (stage 7B.8.2)')
    ON CONFLICT (version) DO NOTHING;
  `);
};

export const down = async () => {
  // forward-only
};
