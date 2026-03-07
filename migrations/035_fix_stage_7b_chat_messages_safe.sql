BEGIN;

-- Create correct table if not exists
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  transport TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_type TEXT NULL,
  global_user_id TEXT NULL,
  sender_id TEXT NULL,
  message_id BIGINT NULL,
  platform_message_id BIGINT NULL,
  text_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created
  ON public.chat_messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_global_user_created
  ON public.chat_messages (global_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_text_hash
  ON public.chat_messages (chat_id, text_hash);

CREATE INDEX IF NOT EXISTS idx_chat_messages_platform_message_id
  ON public.chat_messages (platform_message_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_user_idempotency
  ON public.chat_messages (transport, chat_id, message_id)
  WHERE role='user' AND message_id IS NOT NULL;


-- webhook dedupe table
CREATE TABLE IF NOT EXISTS public.webhook_dedupe_events (
  id BIGSERIAL PRIMARY KEY,
  transport TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  global_user_id TEXT NULL,
  reason TEXT NOT NULL DEFAULT 'retry_duplicate',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_dedupe_events_transport_chat_message
  ON public.webhook_dedupe_events (transport, chat_id, message_id);

CREATE INDEX IF NOT EXISTS idx_webhook_dedupe_events_created
  ON public.webhook_dedupe_events (created_at DESC);

COMMIT;