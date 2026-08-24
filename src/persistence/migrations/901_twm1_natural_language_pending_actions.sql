CREATE TABLE IF NOT EXISTS telegram_workspace_pending_actions (
  token text PRIMARY KEY CHECK (token ~ '^twn_[A-Za-z0-9_-]{12,}$'),
  workspace_id text NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  actor_global_user_id text NOT NULL,
  telegram_user_id text NOT NULL CHECK (telegram_user_id ~ '^[0-9]+$'),
  request_id text NOT NULL,
  trace_id text NOT NULL,
  proposal jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','cancelled','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS telegram_workspace_pending_actions_actor_idx
  ON telegram_workspace_pending_actions(actor_global_user_id, status, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_workspace_pending_actions_request_idx
  ON telegram_workspace_pending_actions(request_id);
