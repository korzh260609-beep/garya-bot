CREATE TABLE IF NOT EXISTS diagnostic_access_audit (
  access_id text PRIMARY KEY,
  actor_global_user_id text,
  method text NOT NULL,
  path text NOT NULL,
  outcome text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diagnostic_access_audit_actor_idx
  ON diagnostic_access_audit(actor_global_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diagnostic_access_audit_path_idx
  ON diagnostic_access_audit(path, created_at DESC);
