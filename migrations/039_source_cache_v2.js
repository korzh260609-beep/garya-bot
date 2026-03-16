export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS source_cache (
      id SERIAL PRIMARY KEY,
      source_key TEXT,
      cache_key TEXT,
      payload JSONB,
      fetched_at TIMESTAMPTZ,
      ttl_sec INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS source_key TEXT;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS cache_key TEXT;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS payload JSONB;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS ttl_sec INTEGER;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'source_cache'
          AND column_name = 'cached_json'
      ) THEN
        UPDATE source_cache
        SET payload = cached_json
        WHERE payload IS NULL
          AND cached_json IS NOT NULL;
      END IF;
    END
    $$;
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'source_cache'
          AND column_name = 'cached_at'
      ) THEN
        UPDATE source_cache
        SET fetched_at = cached_at
        WHERE fetched_at IS NULL
          AND cached_at IS NOT NULL;
      END IF;
    END
    $$;
  `);

  pgm.sql(`
    UPDATE source_cache
    SET cache_key = source_key
    WHERE (cache_key IS NULL OR cache_key = '')
      AND source_key IS NOT NULL
      AND source_key <> '';
  `);

  pgm.sql(`
    UPDATE source_cache
    SET ttl_sec = 20
    WHERE ttl_sec IS NULL OR ttl_sec <= 0;
  `);

  pgm.sql(`
    UPDATE source_cache
    SET payload = '{}'::jsonb
    WHERE payload IS NULL;
  `);

  pgm.sql(`
    UPDATE source_cache
    SET fetched_at = NOW()
    WHERE fetched_at IS NULL;
  `);

  pgm.sql(`
    UPDATE source_cache
    SET source_key = 'unknown'
    WHERE source_key IS NULL OR source_key = '';
  `);

  pgm.sql(`
    UPDATE source_cache
    SET cache_key = CONCAT('legacy:', id::text)
    WHERE cache_key IS NULL OR cache_key = '';
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN source_key SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN cache_key SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN payload SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN fetched_at SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN ttl_sec SET NOT NULL;
  `);

  pgm.sql(`
    ALTER TABLE source_cache
    ALTER COLUMN ttl_sec SET DEFAULT 20;
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'source_cache_source_key_key'
      ) THEN
        ALTER TABLE source_cache
        DROP CONSTRAINT source_cache_source_key_key;
      END IF;
    END
    $$;
  `);

  pgm.sql(`
    DROP INDEX IF EXISTS idx_source_cache_source_key;
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_source_cache_cache_key_uq
    ON source_cache (cache_key);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_source_cache_source_key
    ON source_cache (source_key);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_source_cache_fetched_at
    ON source_cache (fetched_at DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_source_cache_fetched_at;
  `);

  pgm.sql(`
    DROP INDEX IF EXISTS idx_source_cache_source_key;
  `);

  pgm.sql(`
    DROP INDEX IF EXISTS idx_source_cache_cache_key_uq;
  `);
}