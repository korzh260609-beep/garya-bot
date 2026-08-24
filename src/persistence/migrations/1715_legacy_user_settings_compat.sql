-- SG 2.0 -> SG 2.1 compatibility for the legacy user_settings table.
--
-- SG 2.0 migration 024 created user_settings(global_user_id, timezone, ...).
-- Block 16.12 reuses the same table name with project-scoped JSON settings.
-- CREATE TABLE IF NOT EXISTS does not evolve an existing table, so this must
-- run before 172_user_settings_preferences.sql.

DO $$
DECLARE
  legacy_primary_key_name text;
BEGIN
  IF to_regclass(current_schema() || '.user_settings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS global_user_id text,
    ADD COLUMN IF NOT EXISTS project_scope text,
    ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS explicit_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS inferred_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source text,
    ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

  -- Generated columns cannot be expressed safely through a generic ADD COLUMN
  -- when the column already exists, so add it only for the SG 2.0 shape.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_settings'
      AND column_name = 'project_scope_key'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN project_scope_key text
      GENERATED ALWAYS AS (COALESCE(project_scope, '')) STORED;
  END IF;

  -- Preserve the old timezone preference instead of silently abandoning it.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_settings'
      AND column_name = 'timezone'
  ) THEN
    EXECUTE $sql$
      UPDATE user_settings
      SET settings = COALESCE(settings, '{}'::jsonb)
                     || jsonb_build_object('timeZone', timezone),
          explicit_fields = CASE
            WHEN COALESCE(explicit_fields, '[]'::jsonb) ? 'timeZone'
              THEN COALESCE(explicit_fields, '[]'::jsonb)
            ELSE COALESCE(explicit_fields, '[]'::jsonb) || jsonb_build_array('timeZone')
          END,
          source = COALESCE(source, 'legacy-sg20-user-settings'),
          provenance = COALESCE(provenance, '{}'::jsonb)
                       || jsonb_build_object('legacyTable', 'user_settings'),
          updated_at = COALESCE(updated_at, now())
      WHERE timezone IS NOT NULL
    $sql$;
  END IF;

  -- SG 2.0 used PRIMARY KEY(global_user_id). SG 2.1 needs one settings record
  -- per (user, project scope). Drop only the legacy one-column PK; never remove
  -- an already-correct SG 2.1 composite primary key.
  SELECT c.conname
  INTO legacy_primary_key_name
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = c.conkey[1]
  WHERE c.conrelid = to_regclass(current_schema() || '.user_settings')
    AND c.contype = 'p'
    AND cardinality(c.conkey) = 1
    AND a.attname = 'global_user_id'
  LIMIT 1;

  IF legacy_primary_key_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_settings DROP CONSTRAINT %I', legacy_primary_key_name);
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS sg21_user_settings_scope_unique_idx
    ON user_settings(global_user_id, project_scope_key);
END $$;
