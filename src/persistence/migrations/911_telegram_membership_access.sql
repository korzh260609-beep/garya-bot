CREATE TABLE IF NOT EXISTS telegram_workspace_membership_access (
  workspace_id text NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  telegram_user_id text NOT NULL,
  global_user_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('requested','active','expired','removed','declined')),
  access_mode text NOT NULL CHECK (access_mode IN ('free','subscription')),
  requested_at timestamptz NOT NULL,
  approved_at timestamptz,
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  removed_at timestamptz,
  last_payment_charge_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, telegram_user_id)
);
CREATE INDEX IF NOT EXISTS telegram_workspace_membership_access_expiry_idx
  ON telegram_workspace_membership_access(state, access_ends_at)
  WHERE state = 'active' AND access_ends_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_workspace_membership_access_charge_idx
  ON telegram_workspace_membership_access(last_payment_charge_id)
  WHERE last_payment_charge_id IS NOT NULL;
