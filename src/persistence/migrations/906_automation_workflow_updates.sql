CREATE TABLE IF NOT EXISTS automation_workflows (
  automation_id text PRIMARY KEY,
  task_id text UNIQUE REFERENCES tasks(task_id) ON DELETE SET NULL,
  schedule_id text UNIQUE REFERENCES schedules(schedule_id) ON DELETE SET NULL,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  current_version integer NOT NULL CHECK (current_version >= 1),
  workflow jsonb NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','paused','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_workflows_scope_idx
  ON automation_workflows(global_user_id, project_scope, group_scope, thread_scope);

CREATE TABLE IF NOT EXISTS automation_workflow_versions (
  automation_id text NOT NULL REFERENCES automation_workflows(automation_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  previous_version integer,
  workflow jsonb NOT NULL,
  patch_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_global_user_id text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  gate_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automation_id, version),
  CHECK (previous_version IS NULL OR previous_version < version)
);

CREATE INDEX IF NOT EXISTS automation_workflow_versions_history_idx
  ON automation_workflow_versions(automation_id, version DESC);
