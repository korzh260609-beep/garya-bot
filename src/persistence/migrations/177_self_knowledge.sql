CREATE TABLE IF NOT EXISTS system_self_knowledge_snapshots (
  snapshot_id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  source_revision text NOT NULL,
  commit_sha text,
  environment text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('valid','conflicted','invalid')),
  material_hash text NOT NULL,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment, version),
  UNIQUE(environment, material_hash)
);

CREATE INDEX IF NOT EXISTS idx_system_self_knowledge_latest
  ON system_self_knowledge_snapshots(environment, version DESC);

CREATE TABLE IF NOT EXISTS system_self_knowledge_facts (
  snapshot_id text NOT NULL REFERENCES system_self_knowledge_snapshots(snapshot_id) ON DELETE CASCADE,
  fact_id text NOT NULL,
  category text NOT NULL,
  fact_key text NOT NULL,
  value jsonb,
  status text NOT NULL CHECK (status IN ('implemented','partial','planned','disabled','broken','unknown')),
  fact_kind text NOT NULL CHECK (fact_kind IN ('authority','declaration','evidence')),
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(snapshot_id, fact_id)
);

CREATE INDEX IF NOT EXISTS idx_system_self_knowledge_facts_lookup
  ON system_self_knowledge_facts(snapshot_id, category, fact_key);
