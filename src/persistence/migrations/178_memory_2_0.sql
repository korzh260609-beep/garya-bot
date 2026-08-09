-- Memory 2.0 M1-M9. Extend the existing memory_records table in place.
-- Existing SG 2.1 rows remain personal memory owned by their existing global_user_id.

ALTER TABLE memory_records
  ALTER COLUMN global_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS owner_global_user_id text REFERENCES users(global_user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope_kind text,
  ADD COLUMN IF NOT EXISTS privacy_class text,
  ADD COLUMN IF NOT EXISTS confirmation_state text,
  ADD COLUMN IF NOT EXISTS lifecycle_state text,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_class text,
  ADD COLUMN IF NOT EXISTS record_version integer,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE memory_records
SET owner_global_user_id = COALESCE(owner_global_user_id, global_user_id)
WHERE owner_global_user_id IS NULL AND global_user_id IS NOT NULL;

-- Legacy memory was always user-owned, including rows narrowed by group/thread.
UPDATE memory_records
SET scope_kind = CASE
  WHEN group_scope IS NOT NULL THEN 'user-group'
  ELSE 'user'
END
WHERE scope_kind IS NULL;

UPDATE memory_records
SET privacy_class = CASE
  WHEN scope_kind = 'user-group' THEN 'user-group'
  ELSE 'private'
END
WHERE privacy_class IS NULL;

UPDATE memory_records
SET confirmation_state = CASE WHEN confirmed THEN 'confirmed' ELSE 'proposed' END
WHERE confirmation_state IS NULL;

UPDATE memory_records
SET lifecycle_state = CASE
  WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'expired'
  ELSE 'active'
END
WHERE lifecycle_state IS NULL;

UPDATE memory_records SET retention_class = 'durable' WHERE retention_class IS NULL;
UPDATE memory_records SET record_version = 1 WHERE record_version IS NULL;
UPDATE memory_records
SET semantic_fingerprint = md5(
  COALESCE(memory_layer,'') || '|' || COALESCE(memory_key,'') || '|' || value::text || '|' ||
  COALESCE(owner_global_user_id,'-') || '|' || project_scope || '|' || COALESCE(group_scope,'-') || '|' || COALESCE(thread_scope,'-')
)
WHERE semantic_fingerprint IS NULL;

ALTER TABLE memory_records
  ALTER COLUMN scope_kind SET NOT NULL,
  ALTER COLUMN privacy_class SET NOT NULL,
  ALTER COLUMN confirmation_state SET NOT NULL,
  ALTER COLUMN lifecycle_state SET NOT NULL,
  ALTER COLUMN retention_class SET NOT NULL,
  ALTER COLUMN record_version SET NOT NULL,
  ALTER COLUMN semantic_fingerprint SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_scope_kind_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_scope_kind_check
      CHECK (scope_kind IN ('user','user-group','group','thread','project'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_privacy_class_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_privacy_class_check
      CHECK (privacy_class IN ('private','user-group','group','project','system','public'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_confirmation_state_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_confirmation_state_check
      CHECK (confirmation_state IN ('proposed','confirmed','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_lifecycle_state_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_lifecycle_state_check
      CHECK (lifecycle_state IN ('active','temporary','expired','superseded','archived','deleted'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_record_version_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_record_version_check CHECK (record_version > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_owner_scope_check') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_owner_scope_check CHECK (
      (scope_kind = 'user' AND owner_global_user_id IS NOT NULL AND group_scope IS NULL AND thread_scope IS NULL)
      OR (scope_kind = 'user-group' AND owner_global_user_id IS NOT NULL AND group_scope IS NOT NULL)
      OR (scope_kind = 'group' AND owner_global_user_id IS NULL AND group_scope IS NOT NULL AND thread_scope IS NULL)
      OR (scope_kind = 'thread' AND owner_global_user_id IS NULL AND group_scope IS NOT NULL AND thread_scope IS NOT NULL)
      OR (scope_kind = 'project' AND owner_global_user_id IS NULL AND group_scope IS NULL AND thread_scope IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory2_superseded_by_fk') THEN
    ALTER TABLE memory_records ADD CONSTRAINT memory2_superseded_by_fk
      FOREIGN KEY (superseded_by) REFERENCES memory_records(memory_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS memory2_owner_scope_idx
  ON memory_records(owner_global_user_id, project_scope, group_scope, thread_scope, scope_kind, lifecycle_state);
CREATE INDEX IF NOT EXISTS memory2_shared_scope_idx
  ON memory_records(project_scope, group_scope, thread_scope, scope_kind, lifecycle_state)
  WHERE owner_global_user_id IS NULL;
CREATE INDEX IF NOT EXISTS memory2_key_lookup_idx
  ON memory_records(project_scope, memory_layer, memory_key, lifecycle_state);
CREATE INDEX IF NOT EXISTS memory2_semantic_fingerprint_idx
  ON memory_records(semantic_fingerprint);
CREATE INDEX IF NOT EXISTS memory2_lifecycle_expiry_idx
  ON memory_records(lifecycle_state, expires_at) WHERE expires_at IS NOT NULL;
