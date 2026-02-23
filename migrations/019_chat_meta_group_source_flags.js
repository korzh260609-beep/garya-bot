// migrations/019_chat_meta_group_source_flags.js

export async function up(pgm) {
  // Group-as-source safety flags (default = safest OFF)
  pgm.sql(`
    ALTER TABLE chat_meta
      ADD COLUMN IF NOT EXISTS source_enabled boolean NOT NULL DEFAULT false;
  `);

  pgm.sql(`
    ALTER TABLE chat_meta
      ADD COLUMN IF NOT EXISTS privacy_level text NOT NULL DEFAULT 'private_only';
  `);

  pgm.sql(`
    ALTER TABLE chat_meta
      ADD COLUMN IF NOT EXISTS allow_quotes boolean NOT NULL DEFAULT false;
  `);

  pgm.sql(`
    ALTER TABLE chat_meta
      ADD COLUMN IF NOT EXISTS allow_raw_snippets boolean NOT NULL DEFAULT false;
  `);

  // Track schema version
  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (19, 'chat_meta: add group source flags (source_enabled/privacy_level/allow_quotes/allow_raw_snippets)')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down(pgm) {
  // forward-only in prod (formal down only)
  pgm.sql(`ALTER TABLE chat_meta DROP COLUMN IF EXISTS allow_raw_snippets;`);
  pgm.sql(`ALTER TABLE chat_meta DROP COLUMN IF EXISTS allow_quotes;`);
  pgm.sql(`ALTER TABLE chat_meta DROP COLUMN IF EXISTS privacy_level;`);
  pgm.sql(`ALTER TABLE chat_meta DROP COLUMN IF EXISTS source_enabled;`);
}
