CREATE TABLE IF NOT EXISTS telegram_workspace_domain_records (
  workspace_id TEXT NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  record_id TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'workspace',
  privacy_class TEXT NOT NULL DEFAULT 'workspace',
  actor_global_user_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,domain,record_id),
  UNIQUE(workspace_id,idempotency_key),
  CHECK (domain IN ('content','media','poll','test','form','submission','event','registration','feedback','faq','onboarding','moderation','case','decision','content-plan','summary','unanswered','task-link','export','analytics'))
);
CREATE INDEX IF NOT EXISTS telegram_workspace_domain_records_scope_idx ON telegram_workspace_domain_records(workspace_id,domain,status,created_at);
CREATE INDEX IF NOT EXISTS telegram_workspace_domain_records_payload_lookup_idx ON telegram_workspace_domain_records USING GIN(payload);
CREATE TABLE IF NOT EXISTS telegram_workspace_domain_events (
  event_id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  record_domain TEXT NULL,
  record_id TEXT NULL,
  actor_global_user_id TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,event_key)
);
CREATE INDEX IF NOT EXISTS telegram_workspace_domain_events_scope_idx ON telegram_workspace_domain_events(workspace_id,event_type,occurred_at);
CREATE TABLE IF NOT EXISTS telegram_workspace_analytics_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  window_from TIMESTAMPTZ NULL,
  window_to TIMESTAMPTZ NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_workspace_analytics_scope_idx ON telegram_workspace_analytics_snapshots(workspace_id,created_at DESC);
