BEGIN;

DO $$
DECLARE
  v_chat_messages_exists boolean;
  v_has_transport boolean;
  v_has_content boolean;
  v_has_role boolean;
  v_legacy_exists boolean;
BEGIN
  -- 1) Check whether chat_messages already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'chat_messages'
  )
  INTO v_chat_messages_exists;

  -- 2) Detect whether existing chat_messages is the WRONG old 033 shape
  IF v_chat_messages_exists THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'transport'
    )
    INTO v_has_transport;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'content'
    )
    INTO v_has_content;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'role'
    )
    INTO v_has_role;

    -- If table exists but does NOT match current runtime schema,
    -- move it aside so we do not lose data.
    IF NOT (v_has_transport AND v_has_content AND v_has_role) THEN
      -- Avoid rename collision if migration is retried
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'chat_messages_legacy_033_bad'
      )
      INTO v_legacy_exists;

      IF NOT v_legacy_exists THEN
        EXECUTE 'ALTER TABLE public.chat_messages RENAME TO chat_messages_legacy_033_bad';
      ELSE
        -- If backup table already exists, drop wrong current table only if it still exists
        EXECUTE 'DROP TABLE IF EXISTS public.chat_messages CASCADE';
      END IF;
    END IF;
  END IF;
END
$$;

-- 3) Create the CORRECT runtime table
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
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Safe additive fixes in case table already existed in partially-correct form
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS transport TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_id TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS chat_type TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS global_user_id TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_id TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_id BIGINT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS platform_message_id BIGINT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS text_hash TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS truncated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 5) Backfill from legacy wrong table if it exists
INSERT INTO public.chat_messages (
  transport,
  chat_id,
  chat_type,
  global_user_id,
  sender_id,
  message_id,
  platform_message_id,
  text_hash,
  role,
  content,
  truncated,
  metadata,
  raw,
  schema_version,
  created_at
)
SELECT
  COALESCE(NULLIF(platform, ''), 'telegram') AS transport,
  chat_id,
  NULL::TEXT AS chat_type,
  NULL::TEXT AS global_user_id,
  CASE
    WHEN user_id IS NULL OR user_id = '' THEN NULL
    ELSE user_id
  END AS sender_id,
  CASE
    WHEN platform_message_id ~ '^[0-9]+$' THEN platform_message_id::BIGINT
    ELSE NULL
  END AS message_id,
  CASE
    WHEN platform_message_id ~ '^[0-9]+$' THEN platform_message_id::BIGINT
    ELSE NULL
  END AS platform_message_id,
  text_hash,
  CASE
    WHEN direction = 'incoming' THEN 'user'
    WHEN direction = 'outgoing' THEN 'assistant'
    ELSE COALESCE(NULLIF(role, ''), 'system')
  END AS role,
  COALESCE(text_redacted, '') AS content,
  COALESCE(truncated, FALSE) AS truncated,
  '{}'::jsonb AS metadata,
  '{}'::jsonb AS raw,
  1 AS schema_version,
  COALESCE(created_at, NOW()) AS created_at
FROM public.chat_messages_legacy_033_bad
WHERE EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'chat_messages_legacy_033_bad'
)
ON CONFLICT DO NOTHING;

-- 6) Required indexes for runtime
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
  WHERE role = 'user' AND message_id IS NOT NULL;

-- 7) Runtime observability table used by current flow
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