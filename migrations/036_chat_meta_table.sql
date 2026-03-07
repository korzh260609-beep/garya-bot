CREATE TABLE IF NOT EXISTS chat_meta (
    id BIGSERIAL PRIMARY KEY,

    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL,

    chat_type TEXT NOT NULL,
    title TEXT,

    alias TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_meta_platform_chat_id_idx
ON chat_meta (platform, chat_id);