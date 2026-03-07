BEGIN;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  transport TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_type TEXT NULL,
  global_user_id TEXT NULL,
  sender_id TEXT NULL,
  message_id BIGINT NULL,
  platform_message_id BIGINT NULL,
  text_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created
  ON chat_messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_global_user_created
  ON chat_messages (global_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_text_hash
  ON chat_messages (chat_id, text_hash);

CREATE INDEX IF NOT EXISTS idx_chat_messages_platform_message_id
  ON chat_messages (platform_message_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_user_idempotency
  ON chat_messages (transport, chat_id, message_id)
  WHERE role = 'user' AND message_id IS NOT NULL;

COMMIT;