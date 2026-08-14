CREATE TABLE IF NOT EXISTS delivery_records (
  delivery_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('current-response','notification')),
  actor_global_user_id TEXT NOT NULL,
  recipient_global_user_id TEXT NOT NULL,
  project_scope TEXT NOT NULL,
  transport TEXT,
  target JSONB,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  failure_code TEXT,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  provider_result JSONB,
  trace_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_records_recipient_project_idx
  ON delivery_records(recipient_global_user_id, project_scope, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_records_status_idx
  ON delivery_records(status, updated_at DESC);
