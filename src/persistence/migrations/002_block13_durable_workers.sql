ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS protected_action boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS last_error jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE tasks SET kind = COALESCE(kind, payload->>'kind', 'unknown') WHERE kind IS NULL;
ALTER TABLE tasks ALTER COLUMN kind SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_idempotency_key_idx ON tasks(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_claim_idx ON tasks(status, available_at, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS tasks_lease_expiry_idx ON tasks(lease_expires_at) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS dead_letter_tasks (
  dead_letter_id bigserial PRIMARY KEY,
  task_id text NOT NULL UNIQUE REFERENCES tasks(task_id) ON DELETE CASCADE,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz
);
CREATE INDEX IF NOT EXISTS dead_letter_created_idx ON dead_letter_tasks(created_at);
