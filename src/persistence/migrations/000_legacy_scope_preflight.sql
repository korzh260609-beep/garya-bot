-- SG 2.0 -> SG 2.1 preflight.
--
-- Some production SG 2.0 databases may already contain tables whose names are
-- reused by SG 2.1 but whose legacy shape predates project/group/thread scope.
-- `CREATE TABLE IF NOT EXISTS` does not evolve an existing table, so the Block
-- 12 migration can otherwise fail later when it creates scope indexes.
--
-- Keep this migration additive, idempotent and deliberately before 001. It
-- does not delete or reinterpret legacy data and it is safe on already-migrated
-- SG 2.1 databases because every ALTER uses IF NOT EXISTS.

DO $$
BEGIN
  IF to_regclass(current_schema() || '.conversations') IS NOT NULL THEN
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text;
    UPDATE conversations SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.messages') IS NOT NULL THEN
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text;
    UPDATE messages SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.memory_records') IS NOT NULL THEN
    ALTER TABLE memory_records
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text,
      ADD COLUMN IF NOT EXISTS memory_layer text,
      ADD COLUMN IF NOT EXISTS memory_key text;
    UPDATE memory_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.idempotency_records') IS NOT NULL THEN
    ALTER TABLE idempotency_records
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text;
    UPDATE idempotency_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.domain_records') IS NOT NULL THEN
    ALTER TABLE domain_records
      ADD COLUMN IF NOT EXISTS domain_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text;
    UPDATE domain_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;
END $$;
