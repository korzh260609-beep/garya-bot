ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS continuation_policy text NOT NULL DEFAULT 'same-scope',
  ADD COLUMN IF NOT EXISTS current_topic_id text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_state_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_state_check CHECK (state IN ('active','closed'));
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_continuation_policy_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_continuation_policy_check CHECK (continuation_policy IN ('same-scope','approved-cross-transport'));

CREATE TABLE IF NOT EXISTS conversation_topics (
  topic_id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  parent_topic_id text REFERENCES conversation_topics(topic_id) ON DELETE SET NULL,
  topic_key text,
  state text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conversation_topics_state_check CHECK (state IN ('active','closed')),
  CONSTRAINT conversation_topics_not_own_parent CHECK (parent_topic_id IS NULL OR parent_topic_id <> topic_id)
);
CREATE INDEX IF NOT EXISTS conversation_topics_conversation_idx ON conversation_topics(conversation_id, started_at);

CREATE TABLE IF NOT EXISTS conversation_sessions (
  session_id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text NOT NULL,
  group_scope text,
  thread_scope text,
  transport text NOT NULL,
  transport_session_id text,
  state text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conversation_sessions_state_check CHECK (state IN ('active','closed')),
  CHECK (thread_scope IS NULL OR group_scope IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS conversation_sessions_scope_idx ON conversation_sessions(global_user_id, project_scope, group_scope, thread_scope, transport, state, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS conversation_sessions_conversation_idx ON conversation_sessions(conversation_id, state, last_activity_at DESC);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS session_id text REFERENCES conversation_sessions(session_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic_id text REFERENCES conversation_topics(topic_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_message_id text,
  ADD COLUMN IF NOT EXISTS transport text,
  ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE INDEX IF NOT EXISTS messages_recent_conversation_topic_idx ON messages(conversation_id, topic_id, created_at DESC, message_id DESC);
CREATE INDEX IF NOT EXISTS messages_external_reply_idx ON messages(global_user_id, project_scope, group_scope, thread_scope, transport, external_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_identity_unique_idx
  ON messages(transport, external_message_id, global_user_id, project_scope, COALESCE(group_scope,''), COALESCE(thread_scope,''))
  WHERE transport IS NOT NULL AND external_message_id IS NOT NULL;
