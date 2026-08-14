CREATE TABLE IF NOT EXISTS telegram_workspaces (
  workspace_id text PRIMARY KEY CHECK (workspace_id ~ '^tgw_[A-Za-z0-9_-]{8,}$'),
  platform text NOT NULL DEFAULT 'telegram' CHECK (platform = 'telegram'),
  telegram_chat_id text NOT NULL CHECK (telegram_chat_id ~ '^-?[0-9]+$'),
  workspace_type text NOT NULL CHECK (workspace_type IN ('group','supergroup','channel')),
  title text,
  username text,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('DISCOVERED','CONNECTED','CONFIGURING','ACTIVE','DEGRADED','DISCONNECTED','REVOKED')),
  bot_membership_state text NOT NULL DEFAULT 'UNKNOWN',
  migration jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(platform, telegram_chat_id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX IF NOT EXISTS telegram_workspaces_lifecycle_idx
  ON telegram_workspaces(lifecycle_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS telegram_workspace_members (
  workspace_id text NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  global_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','EDITOR','MODERATOR','VIEWER')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_by_global_user_id text,
  source text NOT NULL DEFAULT 'sg',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id, global_user_id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX IF NOT EXISTS telegram_workspace_members_user_idx
  ON telegram_workspace_members(global_user_id, status, workspace_id);

CREATE TABLE IF NOT EXISTS telegram_workspace_bot_permissions (
  workspace_id text PRIMARY KEY REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  membership_state text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > fetched_at)
);

CREATE TABLE IF NOT EXISTS telegram_workspace_configs (
  workspace_id text NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  namespace text NOT NULL CHECK (namespace IN ('general','responses','moderation','memory','ai','publication','content','polls','media','automation','notifications','members')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL CHECK (version >= 1),
  updated_by_global_user_id text NOT NULL,
  trace_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id, namespace)
);

CREATE TABLE IF NOT EXISTS telegram_workspace_config_history (
  history_id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES telegram_workspaces(workspace_id) ON DELETE CASCADE,
  namespace text NOT NULL CHECK (namespace IN ('general','responses','moderation','memory','ai','publication','content','polls','media','automation','notifications','members')),
  version bigint NOT NULL CHECK (version >= 1),
  previous_config jsonb,
  new_config jsonb NOT NULL,
  actor_global_user_id text NOT NULL,
  trace_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, namespace, version)
);

CREATE INDEX IF NOT EXISTS telegram_workspace_config_history_lookup_idx
  ON telegram_workspace_config_history(workspace_id, namespace, version DESC);
