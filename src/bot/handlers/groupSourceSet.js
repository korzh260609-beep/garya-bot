// src/bot/handlers/groupSourceSet.js
// STAGE 7B.9 / 11.18 — Group Source admin toggle (monarch-only, skeleton)
// Usage:
// - /group_source_on [chat_id]
// - /group_source_off [chat_id]

import { getChatMeta, updateChatSourceFlags } from "../../db/chatMetaRepo.js";

export async function handleGroupSourceSet({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  sourceEnabled,
}) {
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
        `⚠️ Не найден chat_meta для chat_id=${targetChatId}. Сначала нужен хотя бы один сохранённый message pair в этом чате.`
      );
      return;
    }

    if (sourceEnabled === true) {
      const alias = String(row.alias || "").trim();

      if (!alias) {
        await bot.sendMessage(
          chatId,
          [
            "⛔ Нельзя включить group source.",
            `chat_id: ${targetChatId}`,
            "reason: alias_required",
            "",
            "В repo уже действует constraint:",
            "source_enabled=true допускается только если alias заполнен.",
          ].join("\n")
        );
        return;
      }
    }

    const updated = await updateChatSourceFlags({
      platform,
      chatId: targetChatId,
      sourceEnabled,
      privacyLevel: null,
      allowQuotes: null,
      allowRawSnippets: null,
    });

    if (!updated) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не удалось обновить group source flags для chat_id=${targetChatId}.`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ GROUP SOURCE UPDATED",
        `chat_id: ${updated.chat_id}`,
        `platform: ${updated.platform || platform}`,
        `chat_type: ${updated.chat_type || "—"}`,
        `alias: ${updated.alias || "—"}`,
        "title: [hidden service field]",
        `source_enabled: ${String(!!updated.source_enabled)}`,
        `privacy_level: ${updated.privacy_level || "—"}`,
        `allow_quotes: ${String(!!updated.allow_quotes)}`,
        `allow_raw_snippets: ${String(!!updated.allow_raw_snippets)}`,
        updated.updated_at ? `updated_at: ${new Date(updated.updated_at).toISOString()}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    console.error("handleGroupSourceSet error:", e);
    await bot.sendMessage(chatId, `⛔ Ошибка: ${e?.message || "unknown"}`);
  }
}