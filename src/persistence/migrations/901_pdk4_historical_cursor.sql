CREATE TABLE IF NOT EXISTS pdk4_history_cursors (
  project_key text NOT NULL,
  source_kind text NOT NULL,
  source_scope text NOT NULL,
  cursor_token text,
  last_source_id text,
  scanned_count bigint NOT NULL DEFAULT 0,
  batch_count bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, source_kind, source_scope),
  CHECK (status IN ('pending','scanning','complete','failed')),
  CHECK (scanned_count >= 0),
  CHECK (batch_count >= 0)
);

CREATE TABLE IF NOT EXISTS pdk4_processed_sources (
  project_key text NOT NULL,
  source_kind text NOT NULL,
  source_scope text NOT NULL,
  source_id text NOT NULL,
  source_fingerprint text NOT NULL,
  source_position text,
  source_timestamp timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, source_kind, source_scope, source_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS pdk4_processed_sources_fingerprint_uq
  ON pdk4_processed_sources(project_key, source_kind, source_scope, source_fingerprint);
CREATE INDEX IF NOT EXISTS pdk4_processed_sources_position_idx
  ON pdk4_processed_sources(project_key, source_kind, source_scope, processed_at, source_id);
