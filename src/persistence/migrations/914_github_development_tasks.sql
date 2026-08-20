CREATE TABLE IF NOT EXISTS github_development_tasks (
  task_id text PRIMARY KEY,
  global_user_id text NOT NULL,
  project_id text NOT NULL,
  repository_full_name text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  task jsonb NOT NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (version > 0)
);
CREATE INDEX IF NOT EXISTS github_development_tasks_scope_idx ON github_development_tasks(global_user_id, project_id, status);
