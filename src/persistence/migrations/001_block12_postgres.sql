CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  global_user_id text PRIMARY KEY,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SG 2.0 compatibility: its users table already exists and global_user_id was
-- indexed but not UNIQUE. Preserve legacy columns while adding the SG 2.1 shape.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS global_user_id text,
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS chat_id text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    WHERE global_user_id IS NOT NULL AND global_user_id <> ''
    GROUP BY global_user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SG 2.0 compatibility: duplicate users.global_user_id values must be resolved before SG 2.1 migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sg21_users_global_user_id_unique_idx
  ON users(global_user_id);

CREATE TABLE IF NOT EXISTS identity_links (
  platform text NOT NULL,
  platform_user_id text NOT NULL,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS identity_links_global_user_idx ON identity_links(global_user_id);

CREATE TABLE IF NOT EXISTS roles (
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (global_user_id, project_scope, role)
);

CREATE TABLE IF NOT EXISTS grants (
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  grant_name text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (global_user_id, project_scope, grant_name)
);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id text PRIMARY KEY,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS conversations_scope_idx ON conversations(global_user_id, project_scope, group_scope, thread_scope);

CREATE TABLE IF NOT EXISTS messages (
  message_id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  content jsonb NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_scope_created_idx ON messages(global_user_id, project_scope, group_scope, thread_scope, created_at);

CREATE TABLE IF NOT EXISTS memory_records (
  memory_id text PRIMARY KEY,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  memory_layer text NOT NULL,
  memory_key text NOT NULL,
  value jsonb NOT NULL,
  provenance jsonb NOT NULL,
  trust text NOT NULL DEFAULT 'unverified',
  confirmed boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(5,4),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS memory_scope_lookup_idx ON memory_records(global_user_id, project_scope, group_scope, thread_scope, memory_layer, memory_key);
CREATE INDEX IF NOT EXISTS memory_expiry_idx ON memory_records(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS tasks (
  task_id text PRIMARY KEY,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  status text NOT NULL,
  payload jsonb NOT NULL,
  approval_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);

-- SG 2.0 compatibility: retain the legacy task row shape and add the SG 2.1
-- identity/scope columns. Legacy NOT NULL title/type columns receive defaults so
-- new SG 2.1 task inserts remain valid without rewriting historical rows.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_id text,
  ADD COLUMN IF NOT EXISTS global_user_id text,
  ADD COLUMN IF NOT EXISTS project_scope text,
  ADD COLUMN IF NOT EXISTS group_scope text,
  ADD COLUMN IF NOT EXISTS thread_scope text,
  ADD COLUMN IF NOT EXISTS approval_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS type text;

ALTER TABLE tasks ALTER COLUMN title SET DEFAULT 'SG 2.1 task';
ALTER TABLE tasks ALTER COLUMN type SET DEFAULT 'sg2.1';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tasks' AND column_name='id') THEN
    EXECUTE 'UPDATE tasks SET task_id = COALESCE(task_id, ''legacy:'' || id::text) WHERE task_id IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tasks' AND column_name='user_global_id') THEN
    EXECUTE 'UPDATE tasks SET global_user_id = COALESCE(global_user_id, user_global_id) WHERE global_user_id IS NULL';
  END IF;
END $$;

UPDATE tasks SET project_scope = COALESCE(project_scope, 'sg2.1') WHERE project_scope IS NULL;
UPDATE tasks SET approval_state = '{}'::jsonb WHERE approval_state IS NULL;
UPDATE tasks SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sg21_tasks_task_id_unique_idx ON tasks(task_id);
CREATE INDEX IF NOT EXISTS tasks_scope_status_idx ON tasks(global_user_id, project_scope, status);

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  due_at timestamptz,
  recurrence text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedules_due_idx ON schedules(due_at) WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS execution_states (
  execution_id text PRIMARY KEY,
  task_id text REFERENCES tasks(task_id) ON DELETE CASCADE,
  status text NOT NULL,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS execution_task_status_idx ON execution_states(task_id, status);

CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key text PRIMARY KEY,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  action_fingerprint text NOT NULL,
  status text NOT NULL,
  result jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idempotency_scope_idx ON idempotency_records(global_user_id, project_scope);

CREATE TABLE IF NOT EXISTS observability_events (
  event_id bigserial PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('audit','telemetry','debug','error')),
  event_class text NOT NULL,
  trace_id text,
  request_id text,
  global_user_id text,
  project_scope text,
  stage text,
  outcome text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observability_trace_idx ON observability_events(trace_id, created_at);
CREATE INDEX IF NOT EXISTS observability_channel_created_idx ON observability_events(channel, created_at);

CREATE TABLE IF NOT EXISTS domain_records (
  domain_id text NOT NULL,
  record_id text NOT NULL,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain_id, record_id),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS domain_scope_idx ON domain_records(domain_id, global_user_id, project_scope, group_scope, thread_scope);
