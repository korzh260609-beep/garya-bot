CREATE TABLE IF NOT EXISTS telegram_recent_media_context (
  actor_global_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  media JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor_global_user_id, telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_recent_media_context_expires_at
  ON telegram_recent_media_context (expires_at);
