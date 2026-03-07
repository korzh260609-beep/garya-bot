CREATE TABLE IF NOT EXISTS decision_telemetry (
  id BIGSERIAL PRIMARY KEY,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  ok BOOLEAN NOT NULL DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'replay',

  baseline JSONB,
  shadow JSONB,
  compare JSONB,
  analysis JSONB,

  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_decision_telemetry_saved_at_desc
  ON decision_telemetry (saved_at DESC);