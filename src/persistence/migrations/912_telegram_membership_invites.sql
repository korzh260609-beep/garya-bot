CREATE TABLE IF NOT EXISTS telegram_workspace_membership_invites (
  workspace_id text PRIMARY KEY REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  invite_link text NOT NULL,
  invite_name text NOT NULL,
  creates_join_request boolean NOT NULL DEFAULT true,
  created_by_global_user_id text NOT NULL,
  created_by_telegram_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  rotated_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
