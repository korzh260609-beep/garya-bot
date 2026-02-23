// src/bot/handlers/chatMetaDebug.js
// STAGE 7B.8 — debug helper (monarch-only via bypass)

import pool from "../../../db.js";

export async function handleChatMetaDebug({ bot, chatId, chatIdStr, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Forbidden (monarch-only).");
    return;
  }

  try {
    const transport = "telegram";

    const r = await pool.query(
      `
      SELECT
        transport,
        chat_id,
        platform,
        chat_type,
        title,
        alias,
        source_enabled,
        privacy_level,
        allow_quotes,
        allow_raw_snippets,
        message_count,
        last_message_at,
        last_role,
        schema_version,
        created_at,
        updated_at
      FROM chat_meta
      WHERE transport = $1 AND chat_id = $2
      LIMIT 1
      `,
      [transport, String(chatIdStr)]
    );

    if (!r || (r.rowCount || 0) === 0) {
      await bot.sendMessage(
        chatId,
        [
          "CHAT_META_DEBUG",
          "status: not_found",
          `transport: ${transport}`,
          `chat_id: ${chatIdStr}`,
          "",
          "ℹ️ Запись появится после следующего сообщения в этом чате (user/assistant).",
        ].join("\n")
      );
      return;
    }

    const row = r.rows[0] || {};

    await bot.sendMessage(
      chatId,
      [
        "CHAT_META_DEBUG",
        `transport: ${row.transport ?? ""}`,
        `chat_id: ${row.chat_id ?? ""}`,
        `platform: ${row.platform ?? ""}`,
        `chat_type: ${row.chat_type ?? ""}`,
        `title: ${row.title ?? ""}`,
        `alias: ${row.alias ?? ""}`,
        `source_enabled: ${row.source_enabled ?? ""}`,
        `privacy_level: ${row.privacy_level ?? ""}`,
        `allow_quotes: ${row.allow_quotes ?? ""}`,
        `allow_raw_snippets: ${row.allow_raw_snippets ?? ""}`,
        `message_count: ${row.message_count ?? ""}`,
        `last_message_at: ${row.last_message_at ?? ""}`,
        `last_role: ${row.last_role ?? ""}`,
        `schema_version: ${row.schema_version ?? ""}`,
        `created_at: ${row.created_at ?? ""}`,
        `updated_at: ${row.updated_at ?? ""}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /chat_meta_debug failed:", e);
    await bot.sendMessage(chatId, "⚠️ chat_meta_debug error.");
  }
}
