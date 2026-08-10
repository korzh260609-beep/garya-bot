CREATE TABLE IF NOT EXISTS pdk4_continuous_ingestion_state (
  project_key text NOT NULL,
  repository text NOT NULL,
  bootstrap_last_source_id text NOT NULL,
  last_source_id text,
  last_commit_sha text,
  processed_count bigint NOT NULL DEFAULT 0,
  last_processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, repository),
  CHECK (processed_count >= 0)
);

CREATE TABLE IF NOT EXISTS pdk4_continuous_processed_sources (
  project_key text NOT NULL,
  repository text NOT NULL,
  source_id text NOT NULL,
  source_fingerprint text NOT NULL,
  commit_sha text NOT NULL,
  occurred_at timestamptz NOT NULL,
  trigger_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, repository, source_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pdk4_continuous_source_fingerprint_uq ON pdk4_continuous_processed_sources(project_key,repository,source_fingerprint);
CREATE INDEX IF NOT EXISTS pdk4_continuous_commit_idx ON pdk4_continuous_processed_sources(project_key,repository,occurred_at,commit_sha);

CREATE TABLE IF NOT EXISTS pdk4_continuous_triggers (
  project_key text NOT NULL,
  repository text NOT NULL,
  trigger_id text NOT NULL,
  trigger_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, repository, trigger_id),
  CHECK (trigger_type IN ('poll','webhook','event'))
);
