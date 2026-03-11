import pool from "../../db.js";

export async function upsertChatMeta({
  platform,
  chatId,
  chatType,
  title = null,
}) {
  const res = await pool.query(
    `
    INSERT INTO chat_meta (
      platform,
      chat_id,
      chat_type,
      title
    )
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (platform, chat_id)
    DO UPDATE SET
      chat_type = EXCLUDED.chat_type,
      title = COALESCE(EXCLUDED.title, chat_meta.title)
    RETURNING *
    `,
    [platform, chatId, chatType, title]
  );

  return res.rows[0];
}

export async function getChatMeta(platform, chatId) {
  const res = await pool.query(
    `
    SELECT *
    FROM chat_meta
    WHERE platform = $1
      AND chat_id = $2
    LIMIT 1
    `,
    [platform, chatId]
  );

  return res.rows[0] || null;
}

export async function updateChatSourceFlags({
  platform,
  chatId,
  sourceEnabled,
  privacyLevel,
  allowQuotes,
  allowRawSnippets,
}) {
  const res = await pool.query(
    `
    UPDATE chat_meta
    SET
      source_enabled = COALESCE($3, source_enabled),
      privacy_level = COALESCE($4, privacy_level),
      allow_quotes = COALESCE($5, allow_quotes),
      allow_raw_snippets = COALESCE($6, allow_raw_snippets)
    WHERE platform = $1
      AND chat_id = $2
    RETURNING *
    `,
    [
      platform,
      chatId,
      sourceEnabled ?? null,
      privacyLevel ?? null,
      allowQuotes ?? null,
      allowRawSnippets ?? null,
    ]
  );

  return res.rows[0] || null;
}

export async function updateChatMetaFields({
  platform,
  chatId,
  alias,
  privacyLevel,
}) {
  const res = await pool.query(
    `
    UPDATE chat_meta
    SET
      alias = COALESCE($3, alias),
      privacy_level = COALESCE($4, privacy_level)
    WHERE platform = $1
      AND chat_id = $2
    RETURNING *
    `,
    [
      platform,
      chatId,
      alias ?? null,
      privacyLevel ?? null,
    ]
  );

  return res.rows[0] || null;
}

export async function listKnownChats({
  platform = "telegram",
  limit = 20,
  includePrivate = false,
} = {}) {
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Math.trunc(Number(limit))))
    : 20;

  const res = await pool.query(
    `
    SELECT
      platform,
      chat_id,
      chat_type,
      alias,
      source_enabled,
      privacy_level,
      allow_quotes,
      allow_raw_snippets,
      message_count,
      last_message_at,
      updated_at
    FROM chat_meta
    WHERE platform = $1
      AND ($2::boolean = true OR COALESCE(chat_type, '') <> 'private')
    ORDER BY
      COALESCE(last_message_at, updated_at) DESC NULLS LAST,
      updated_at DESC NULLS LAST,
      chat_id ASC
    LIMIT $3
    `,
    [platform, includePrivate, safeLimit]
  );

  return Array.isArray(res.rows) ? res.rows : [];
}