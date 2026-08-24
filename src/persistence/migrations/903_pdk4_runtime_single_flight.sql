CREATE TABLE IF NOT EXISTS pdk4_runtime_leases (
  project_key text NOT NULL,
  repository text NOT NULL,
  owner_id text NOT NULL,
  lease_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_key, repository)
);

CREATE INDEX IF NOT EXISTS idx_pdk4_runtime_leases_expiry ON pdk4_runtime_leases(lease_until);
