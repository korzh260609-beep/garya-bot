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