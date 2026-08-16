CREATE TABLE IF NOT EXISTS automation_workflow_step_runs (
  task_id text NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  automation_id text NOT NULL,
  workflow_version integer NOT NULL CHECK (workflow_version >= 1),
  step_index integer NOT NULL CHECK (step_index >= 0),
  step_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'denied', 'cancelled')),
  output jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, step_index)
);

CREATE INDEX IF NOT EXISTS automation_workflow_step_runs_automation_idx
  ON automation_workflow_step_runs(automation_id, workflow_version, step_index);
