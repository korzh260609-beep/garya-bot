// src/bot/handlers/groupSources.js
// STAGE 7B.9 / 11.18 — Group Source admin status (monarch-only, skeleton)
// Usage:
// - /group_sources [chat_id]

import { getChatMeta } from "../../db/chatMetaRepo.js";

export async function handleGroupSources({ bot, chatId, chatIdStr, rest, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const raw = String(rest || "").trim();
  const targetChatId = raw && /^-?\d+$/.test(raw) ? String(raw) : String(chatIdStr);
  const platform = "telegram";

  try {
    const row = await getChatMeta(platform, targetChatId);

    if (!row) {
      await bot.sendMessage(
        chatId,
        [
          "GROUP SOURCE STATUS",
          "status: not_found",
          `platform: ${platform}`,
          `chat_id: ${targetChatId}`,
          "",
          "ℹ️ Запись появится после сохранения chat_meta для этого чата.",
        ].join("\n")
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "GROUP SOURCE STATUS",
        `chat_id: ${row.chat_id}`,
        `platform: ${row.platform || platform}`,
        `chat_type: ${row.chat_type || "—"}`,
        `alias: ${row.alias || "—"}`,
        "title: [hidden service field]",
        `source_enabled: ${String(!!row.source_enabled)}`,
        `privacy_level: ${row.privacy_level || "—"}`,
        `allow_quotes: ${String(!!row.allow_quotes)}`,
        `allow_raw_snippets: ${String(!!row.allow_raw_snippets)}`,
        `message_count: ${row.message_count ?? "—"}`,
        row.last_message_at ? `last_message_at: ${row.last_message_at}` : "last_message_at: —",
        row.updated_at ? `updated_at: ${new Date(row.updated_at).toISOString()}` : "updated_at: —",
      ].join("\n")
    );
  } catch (e) {
    console.error("handleGroupSources error:", e);
    await bot.sendMessage(chatId, `⛔ Ошибка: ${e?.message || "unknown"}`);
  }
}