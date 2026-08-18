CREATE TABLE IF NOT EXISTS telegram_workspace_membership_policy (
  workspace_id text PRIMARY KEY REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  enforcement_mode text NOT NULL DEFAULT 'baseline'
    CHECK (enforcement_mode IN ('baseline','strict')),
  baseline_started_at timestamptz NOT NULL,
  strict_enabled_at timestamptz,
  strict_enabled_by_global_user_id text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (enforcement_mode = 'baseline' AND strict_enabled_at IS NULL AND strict_enabled_by_global_user_id IS NULL)
    OR
    (enforcement_mode = 'strict' AND strict_enabled_at IS NOT NULL AND strict_enabled_by_global_user_id IS NOT NULL)
  )
);
