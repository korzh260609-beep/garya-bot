CREATE TABLE IF NOT EXISTS automation_workflow_runs (
  run_id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  automation_id text NOT NULL,
  workflow_version integer NOT NULL CHECK (workflow_version >= 1),
  occurrence_id text NOT NULL,
  attempt integer NOT NULL CHECK (attempt >= 1),
  trace_id text,
  request_id text,
  status text NOT NULL CHECK (status IN ('running','completed','partial','failed','denied','cancelled')),
  output jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  retryable boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(automation_id, occurrence_id, attempt)
);

CREATE INDEX IF NOT EXISTS automation_workflow_runs_history_idx
  ON automation_workflow_runs(automation_id, started_at DESC, run_id);

INSERT INTO automation_workflow_runs(
  run_id, task_id, automation_id, workflow_version, occurrence_id, attempt,
  status, output, evidence_refs, error_code, error_message, started_at, completed_at, updated_at
)
SELECT
  task_id || ':legacy', task_id, min(automation_id), max(workflow_version), task_id, 1,
  CASE
    WHEN bool_or(status = 'running') THEN 'running'
    WHEN bool_or(status = 'failed') THEN 'failed'
    WHEN bool_or(status = 'denied') THEN 'denied'
    WHEN bool_or(status = 'cancelled') THEN 'cancelled'
    WHEN bool_or(status = 'partial') THEN 'partial'
    ELSE 'completed'
  END,
  NULL, '[]'::jsonb,
  max(error_code), max(error_message), min(started_at), max(completed_at), max(updated_at)
FROM automation_workflow_step_runs
GROUP BY task_id
ON CONFLICT DO NOTHING;

ALTER TABLE automation_workflow_step_runs
  ADD COLUMN IF NOT EXISTS run_id text;

UPDATE automation_workflow_step_runs
SET run_id = task_id || ':legacy'
WHERE run_id IS NULL;

ALTER TABLE automation_workflow_step_runs
  ALTER COLUMN run_id SET NOT NULL;

ALTER TABLE automation_workflow_step_runs
  DROP CONSTRAINT IF EXISTS automation_workflow_step_runs_pkey;

ALTER TABLE automation_workflow_step_runs
  ADD CONSTRAINT automation_workflow_step_runs_pkey PRIMARY KEY (run_id, step_index);

ALTER TABLE automation_workflow_step_runs
  DROP CONSTRAINT IF EXISTS automation_workflow_step_runs_run_id_fkey;

ALTER TABLE automation_workflow_step_runs
  ADD CONSTRAINT automation_workflow_step_runs_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES automation_workflow_runs(run_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS automation_workflow_step_runs_task_idx
  ON automation_workflow_step_runs(task_id, started_at DESC, step_index);

CREATE TABLE IF NOT EXISTS automation_workflow_run_events (
  event_id bigserial PRIMARY KEY,
  run_id text NOT NULL REFERENCES automation_workflow_runs(run_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  step_index integer CHECK (step_index IS NULL OR step_index >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_workflow_run_events_order_idx
  ON automation_workflow_run_events(run_id, event_id);
