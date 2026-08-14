-- Project Memory 3.0 PM3.2 — durable PostgreSQL specialization inside Memory 2.0.
-- Canonical project facts remain memory_records rows with scope_kind='project' and memory_layer='project-memory'.
-- These tables normalize project-specific provenance, relations, conflicts, history and retrieval-index metadata.

CREATE TABLE IF NOT EXISTS project_memory_entries (
  memory_id text PRIMARY KEY REFERENCES memory_records(memory_id) ON DELETE CASCADE,
  project_key text NOT NULL,
  namespace text NOT NULL,
  domain text NOT NULL,
  fact_type text NOT NULL,
  entity_key text NOT NULL,
  fact jsonb NOT NULL,
  trace_id text,
  source_event_id text,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  successor_memory_id text REFERENCES memory_records(memory_id) ON DELETE SET NULL,
  record_version integer NOT NULL DEFAULT 1,
  embedding_model text,
  embedding_dimensions integer,
  embedding_status text NOT NULL DEFAULT 'not-indexed',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT project_memory_entry_project_key_check CHECK (project_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT project_memory_entry_namespace_check CHECK (namespace LIKE 'project.' || project_key || '.%'),
  CONSTRAINT project_memory_entry_trace_event_check CHECK (trace_id IS NOT NULL OR source_event_id IS NOT NULL),
  CONSTRAINT project_memory_entry_validity_check CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT project_memory_entry_version_check CHECK (record_version > 0),
  CONSTRAINT project_memory_entry_embedding_dimensions_check CHECK (embedding_dimensions IS NULL OR embedding_dimensions > 0),
  CONSTRAINT project_memory_entry_embedding_status_check CHECK (embedding_status IN ('not-indexed','pending','ready','failed'))
);

CREATE TABLE IF NOT EXISTS project_memory_provenance (
  provenance_id text PRIMARY KEY,
  memory_id text NOT NULL REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  project_key text NOT NULL,
  source_kind text NOT NULL,
  source_ref text NOT NULL,
  actor_id text,
  source_timestamp timestamptz,
  trace_id text,
  source_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_memory_provenance_trace_event_check CHECK (trace_id IS NOT NULL OR source_event_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS project_memory_relations (
  relation_id text PRIMARY KEY,
  project_key text NOT NULL,
  source_memory_id text NOT NULL REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  relation_key text NOT NULL,
  target_memory_id text REFERENCES project_memory_entries(memory_id) ON DELETE SET NULL,
  relation_type text NOT NULL DEFAULT 'related',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_memory_conflicts (
  conflict_id text PRIMARY KEY,
  project_key text NOT NULL,
  memory_id text NOT NULL REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  conflicting_memory_id text NOT NULL REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT project_memory_conflict_distinct_check CHECK (memory_id <> conflicting_memory_id),
  CONSTRAINT project_memory_conflict_status_check CHECK (status IN ('open','resolved','dismissed'))
);

CREATE TABLE IF NOT EXISTS project_memory_history (
  history_id text PRIMARY KEY,
  memory_id text NOT NULL REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  project_key text NOT NULL,
  event_type text NOT NULL,
  lifecycle_state text NOT NULL,
  record_version integer NOT NULL,
  trace_id text,
  source_event_id text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_memory_history_version_check CHECK (record_version > 0)
);

CREATE INDEX IF NOT EXISTS project_memory_entries_scope_idx
  ON project_memory_entries(project_key, namespace, fact_type, entity_key, valid_from DESC);
CREATE INDEX IF NOT EXISTS project_memory_entries_current_idx
  ON project_memory_entries(project_key, namespace, entity_key, valid_from DESC)
  WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS project_memory_entries_trace_idx
  ON project_memory_entries(project_key, trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_memory_entries_source_event_idx
  ON project_memory_entries(project_key, source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_memory_provenance_lookup_idx
  ON project_memory_provenance(project_key, source_kind, source_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS project_memory_relations_source_idx
  ON project_memory_relations(project_key, source_memory_id, relation_type);
CREATE INDEX IF NOT EXISTS project_memory_relations_key_idx
  ON project_memory_relations(project_key, relation_key);
CREATE INDEX IF NOT EXISTS project_memory_conflicts_open_idx
  ON project_memory_conflicts(project_key, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS project_memory_history_lookup_idx
  ON project_memory_history(project_key, memory_id, created_at DESC);

-- Optional pgvector path. Do not CREATE EXTENSION here: production privileges/configuration stay explicit.
-- If pgvector is already installed, add a vector-typed column without fixing dimensions yet;
-- PM3.7 can later choose the model/dimension and create the appropriate ANN index in a versioned migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'project_memory_entries'
         AND column_name = 'embedding'
     ) THEN
    EXECUTE 'ALTER TABLE project_memory_entries ADD COLUMN embedding vector';
  END IF;
END $$;
