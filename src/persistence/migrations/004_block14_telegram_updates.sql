CREATE TABLE telegram_updates (
  update_id bigint PRIMARY KEY,
  update_type text NOT NULL,
  chat_id text,
  user_id text,
  message_id text,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'ignored', 'failed')),
  failure_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX telegram_updates_received_at_idx ON telegram_updates(received_at DESC);
