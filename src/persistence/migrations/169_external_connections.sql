CREATE TABLE IF NOT EXISTS external_connections (
  connection_id text PRIMARY KEY,
  provider text NOT NULL,
  service_type text NOT NULL,
  owner_global_user_id text,
  project_scope text NOT NULL,
  external_account_id text NOT NULL,
  external_account jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_id text,
  granted_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'connected',
  health_state text NOT NULL DEFAULT 'unknown',
  last_verified_at timestamptz,
  last_successful_verification_at timestamptz,
  revoked_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_connections_status_check CHECK (status IN ('connected','degraded','unavailable','revoked')),
  CONSTRAINT external_connections_health_check CHECK (health_state IN ('unknown','healthy','degraded','unavailable','revoked')),
  CONSTRAINT external_connections_scopes_array CHECK (jsonb_typeof(granted_scopes) = 'array'),
  CONSTRAINT external_connections_permissions_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT external_connections_capabilities_array CHECK (jsonb_typeof(capabilities) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS external_connections_account_scope_unique
  ON external_connections(provider, project_scope, COALESCE(owner_global_user_id, ''), external_account_id);

CREATE INDEX IF NOT EXISTS external_connections_owner_project_idx
  ON external_connections(owner_global_user_id, project_scope, provider, status);

CREATE INDEX IF NOT EXISTS external_connections_capabilities_gin_idx
  ON external_connections USING gin(capabilities);
