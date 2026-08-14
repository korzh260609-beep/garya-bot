CREATE TABLE IF NOT EXISTS feature_flags (
  feature_id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  security_mode TEXT NOT NULL DEFAULT 'fail-closed' CHECK (security_mode IN ('fail-closed','normal')),
  environments JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(environments)='array'),
  projects JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(projects)='array'),
  roles JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(roles)='array'),
  users JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(users)='array'),
  resources JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(resources)='array'),
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(cohorts)='array'),
  percentage INTEGER NOT NULL DEFAULT 10000 CHECK (percentage BETWEEN 0 AND 10000),
  expires_at TIMESTAMPTZ,
  review_at TIMESTAMPTZ,
  temporary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  version TEXT NOT NULL DEFAULT '1.0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT temporary OR expires_at IS NOT NULL OR review_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON feature_flags(enabled, kill_switch);
CREATE INDEX IF NOT EXISTS feature_flags_review_idx ON feature_flags(review_at) WHERE review_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS feature_flags_expiry_idx ON feature_flags(expires_at) WHERE expires_at IS NOT NULL;
