BEGIN;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_message_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  user_id TEXT NULL,
  role TEXT NULL,
  text_raw TEXT NULL,
  text_redacted TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created
  ON chat_messages (chat_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_chat_platform_msg
  ON chat_messages (chat_id, platform_message_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_text_hash
  ON chat_messages (chat_id, text_hash);

COMMIT;