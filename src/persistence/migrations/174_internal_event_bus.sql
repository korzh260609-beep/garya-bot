CREATE TABLE IF NOT EXISTS internal_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  trace_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_global_user_id TEXT,
  privacy_class TEXT NOT NULL CHECK (privacy_class IN ('internal','sensitive')),
  ordering_key TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internal_events_type_time_idx
  ON internal_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS internal_events_project_time_idx
  ON internal_events((scope->>'projectScope'), occurred_at DESC);
CREATE INDEX IF NOT EXISTS internal_events_user_time_idx
  ON internal_events((scope->>'globalUserId'), occurred_at DESC);
CREATE INDEX IF NOT EXISTS internal_events_ordering_idx
  ON internal_events(ordering_key, occurred_at, event_id)
  WHERE ordering_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS internal_event_subscriptions (
  subscriber_id TEXT PRIMARY KEY,
  event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  mode TEXT NOT NULL CHECK (mode IN ('sync','durable')),
  project_scope TEXT,
  global_user_id TEXT,
  resource_id TEXT,
  privacy_classes JSONB NOT NULL DEFAULT '["internal","sensitive"]'::jsonb,
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_event_deliveries (
  delivery_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES internal_events(event_id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES internal_event_subscriptions(subscriber_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','delivered','dead-letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  failure_code TEXT,
  next_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS internal_event_deliveries_pending_idx
  ON internal_event_deliveries(status, next_attempt_at, created_at)
  WHERE status='pending';
CREATE INDEX IF NOT EXISTS internal_event_deliveries_dead_letter_idx
  ON internal_event_deliveries(updated_at DESC)
  WHERE status='dead-letter';
