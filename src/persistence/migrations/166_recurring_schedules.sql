ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS dtstart_local text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS misfire_policy text NOT NULL DEFAULT 'fire_once',
  ADD COLUMN IF NOT EXISTS max_catchup integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS generated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_occurrence_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_occurrence_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schedules_status_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_status_check CHECK (status IN ('active','paused','completed','cancelled','error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schedules_misfire_policy_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_misfire_policy_check CHECK (misfire_policy IN ('skip','fire_once','catch_up'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schedules_max_catchup_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_max_catchup_check CHECK (max_catchup BETWEEN 1 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='schedules_generated_count_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_generated_count_check CHECK (generated_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS schedules_recurring_due_idx
  ON schedules(status, next_occurrence_at)
  WHERE status='active' AND recurrence IS NOT NULL;

CREATE TABLE IF NOT EXISTS schedule_occurrences (
  schedule_id text NOT NULL REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 1),
  scheduled_for timestamptz NOT NULL,
  local_datetime text NOT NULL,
  timezone text NOT NULL,
  task_id text NOT NULL UNIQUE REFERENCES tasks(task_id) ON DELETE CASCADE,
  materialized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(schedule_id, sequence),
  UNIQUE(schedule_id, scheduled_for)
);
CREATE INDEX IF NOT EXISTS schedule_occurrences_time_idx ON schedule_occurrences(schedule_id, scheduled_for);
