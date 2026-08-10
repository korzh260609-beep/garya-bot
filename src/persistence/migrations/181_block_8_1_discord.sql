CREATE TABLE IF NOT EXISTS discord_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  guild_id text,
  channel_id text,
  user_id text,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'ignored', 'failed')),
  failure_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS discord_events_received_at_idx ON discord_events(received_at DESC);
CREATE INDEX IF NOT EXISTS discord_events_scope_idx ON discord_events(guild_id, channel_id, received_at DESC);
CREATE INDEX IF NOT EXISTS discord_events_user_idx ON discord_events(user_id, received_at DESC);
