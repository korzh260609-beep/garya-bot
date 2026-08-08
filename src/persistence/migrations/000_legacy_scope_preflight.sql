-- SG 2.0 -> SG 2.1 compatibility preflight.
--
-- Production SG 2.0 databases can already contain table names later reused by
-- SG 2.1. PostgreSQL `CREATE TABLE IF NOT EXISTS` does not evolve an existing
-- table, so Block 12 can otherwise fail while creating indexes/FKs against
-- columns that only exist in the SG 2.1 definition.
--
-- This migration intentionally runs before 001. It is additive/idempotent,
-- preserves legacy columns/rows and creates only the minimum SG 2.1 columns
-- and uniqueness required for later migrations and repository ON CONFLICT
-- clauses. Existing released migrations are left byte-for-byte unchanged so
-- databases that already recorded their checksums remain valid.

DO $$
BEGIN
  IF to_regclass(current_schema() || '.identity_links') IS NOT NULL THEN
    ALTER TABLE identity_links
      ADD COLUMN IF NOT EXISTS platform text,
      ADD COLUMN IF NOT EXISTS platform_user_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF to_regclass(current_schema() || '.roles') IS NOT NULL THEN
    ALTER TABLE roles
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS role text,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='roles' AND column_name='user_global_id') THEN
      EXECUTE 'UPDATE roles SET global_user_id = COALESCE(global_user_id, user_global_id) WHERE global_user_id IS NULL';
    END IF;
    UPDATE roles SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.grants') IS NOT NULL THEN
    ALTER TABLE grants
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS grant_name text,
      ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='grants' AND column_name='user_global_id') THEN
      EXECUTE 'UPDATE grants SET global_user_id = COALESCE(global_user_id, user_global_id) WHERE global_user_id IS NULL';
    END IF;
    UPDATE grants SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.conversations') IS NOT NULL THEN
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS conversation_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='conversations' AND column_name='id') THEN
      EXECUTE 'UPDATE conversations SET conversation_id = COALESCE(conversation_id, ''legacy:'' || id::text) WHERE conversation_id IS NULL';
    ELSE
      UPDATE conversations SET conversation_id = COALESCE(conversation_id, 'legacy:' || md5(ctid::text)) WHERE conversation_id IS NULL;
    END IF;
    UPDATE conversations SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.messages') IS NOT NULL THEN
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS message_id text,
      ADD COLUMN IF NOT EXISTS conversation_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text,
      ADD COLUMN IF NOT EXISTS direction text,
      ADD COLUMN IF NOT EXISTS content jsonb,
      ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='messages' AND column_name='id') THEN
      EXECUTE 'UPDATE messages SET message_id = COALESCE(message_id, ''legacy:'' || id::text) WHERE message_id IS NULL';
    ELSE
      UPDATE messages SET message_id = COALESCE(message_id, 'legacy:' || md5(ctid::text)) WHERE message_id IS NULL;
    END IF;
    UPDATE messages SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.memory_records') IS NOT NULL THEN
    ALTER TABLE memory_records
      ADD COLUMN IF NOT EXISTS memory_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text,
      ADD COLUMN IF NOT EXISTS memory_layer text,
      ADD COLUMN IF NOT EXISTS memory_key text,
      ADD COLUMN IF NOT EXISTS value jsonb,
      ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS trust text NOT NULL DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS confidence numeric(5,4),
      ADD COLUMN IF NOT EXISTS expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='memory_records' AND column_name='id') THEN
      EXECUTE 'UPDATE memory_records SET memory_id = COALESCE(memory_id, ''legacy:'' || id::text) WHERE memory_id IS NULL';
    ELSE
      UPDATE memory_records SET memory_id = COALESCE(memory_id, 'legacy:' || md5(ctid::text)) WHERE memory_id IS NULL;
    END IF;
    UPDATE memory_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.idempotency_records') IS NOT NULL THEN
    ALTER TABLE idempotency_records
      ADD COLUMN IF NOT EXISTS idempotency_key text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS action_fingerprint text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS result jsonb,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='idempotency_records' AND column_name='id') THEN
      EXECUTE 'UPDATE idempotency_records SET idempotency_key = COALESCE(idempotency_key, ''legacy:'' || id::text) WHERE idempotency_key IS NULL';
    ELSE
      UPDATE idempotency_records SET idempotency_key = COALESCE(idempotency_key, 'legacy:' || md5(ctid::text)) WHERE idempotency_key IS NULL;
    END IF;
    UPDATE idempotency_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;

  IF to_regclass(current_schema() || '.domain_records') IS NOT NULL THEN
    ALTER TABLE domain_records
      ADD COLUMN IF NOT EXISTS domain_id text,
      ADD COLUMN IF NOT EXISTS record_id text,
      ADD COLUMN IF NOT EXISTS global_user_id text,
      ADD COLUMN IF NOT EXISTS project_scope text,
      ADD COLUMN IF NOT EXISTS group_scope text,
      ADD COLUMN IF NOT EXISTS thread_scope text,
      ADD COLUMN IF NOT EXISTS payload jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='domain_records' AND column_name='id') THEN
      EXECUTE 'UPDATE domain_records SET record_id = COALESCE(record_id, ''legacy:'' || id::text) WHERE record_id IS NULL';
    ELSE
      UPDATE domain_records SET record_id = COALESCE(record_id, 'legacy:' || md5(ctid::text)) WHERE record_id IS NULL;
    END IF;
    UPDATE domain_records SET domain_id = COALESCE(domain_id, 'legacy') WHERE domain_id IS NULL;
    UPDATE domain_records SET project_scope = 'sg2.1' WHERE project_scope IS NULL;
  END IF;
END $$;

-- Unique indexes below provide the conflict targets/FK uniqueness that would
-- normally be created by CREATE TABLE in 001, but which PostgreSQL skips when
-- the legacy table already exists.
CREATE UNIQUE INDEX IF NOT EXISTS sg21_identity_links_identity_unique_idx
  ON identity_links(platform, platform_user_id)
  WHERE platform IS NOT NULL AND platform_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_roles_scope_unique_idx
  ON roles(global_user_id, project_scope, role)
  WHERE global_user_id IS NOT NULL AND project_scope IS NOT NULL AND role IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_grants_scope_unique_idx
  ON grants(global_user_id, project_scope, grant_name)
  WHERE global_user_id IS NOT NULL AND project_scope IS NOT NULL AND grant_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_conversations_id_unique_idx
  ON conversations(conversation_id)
  WHERE conversation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_messages_id_unique_idx
  ON messages(message_id)
  WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_memory_records_id_unique_idx
  ON memory_records(memory_id)
  WHERE memory_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_idempotency_records_key_unique_idx
  ON idempotency_records(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sg21_domain_records_key_unique_idx
  ON domain_records(domain_id, record_id)
  WHERE domain_id IS NOT NULL AND record_id IS NOT NULL;
