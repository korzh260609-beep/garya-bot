CREATE TABLE IF NOT EXISTS managed_resources (
  resource_id text PRIMARY KEY,
  resource_type text NOT NULL,
  provider text NOT NULL,
  project_scope text NOT NULL,
  connection_id text,
  external_resource_id text NOT NULL,
  parent_resource_id text REFERENCES managed_resources(resource_id) ON DELETE RESTRICT,
  verification_state text NOT NULL DEFAULT 'unverified',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT managed_resources_verification_check CHECK (verification_state IN ('unverified','verified','rejected')),
  CONSTRAINT managed_resources_not_own_parent CHECK (parent_resource_id IS NULL OR parent_resource_id <> resource_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS managed_resources_external_scope_unique
  ON managed_resources(provider, project_scope, COALESCE(connection_id, ''), external_resource_id);
CREATE INDEX IF NOT EXISTS managed_resources_project_idx
  ON managed_resources(project_scope, provider, resource_type);
CREATE INDEX IF NOT EXISTS managed_resources_parent_idx
  ON managed_resources(parent_resource_id);

CREATE TABLE IF NOT EXISTS resource_authorities (
  authority_id text PRIMARY KEY,
  resource_id text NOT NULL REFERENCES managed_resources(resource_id) ON DELETE CASCADE,
  actor_global_user_id text NOT NULL,
  project_scope text NOT NULL,
  relation text NOT NULL,
  applies_to_descendants boolean NOT NULL DEFAULT false,
  delegated_by_global_user_id text,
  verification_state text NOT NULL DEFAULT 'verified',
  verification_source text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'active',
  verified_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_authorities_relation_check CHECK (relation IN ('owns','administers','manages','can_read','can_publish','can_modify')),
  CONSTRAINT resource_authorities_state_check CHECK (state IN ('active','revoked')),
  CONSTRAINT resource_authorities_verification_check CHECK (verification_state IN ('unverified','verified','rejected'))
);

CREATE INDEX IF NOT EXISTS resource_authorities_actor_project_idx
  ON resource_authorities(actor_global_user_id, project_scope, state);
CREATE INDEX IF NOT EXISTS resource_authorities_resource_idx
  ON resource_authorities(resource_id, state);
