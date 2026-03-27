// src/bot/handlers/renderLogSet.js
// Handler for /render_log_set — save latest log snapshot into RenderLogInbox.
// Supports BOTH:
// 1) /render_log_set <inline log text>
// 2) reply to message with log text and send /render_log_set

import renderLogInbox from "../../logging/RenderLogInbox.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractReplyText(msg) {
  const reply = msg?.reply_to_message;
  if (!reply || typeof reply !== "object") return "";

  const text = normalizeString(reply.text);
  if (text) return text;

  const caption = normalizeString(reply.caption);
  if (caption) return caption;

  return "";
}

function extractInlineText(rest) {
  return typeof rest === "string" ? rest.trim() : "";
}

function buildUsageText() {
  return [
    "Использование /render_log_set:",
    "1) /render_log_set <вставь лог после команды>",
    "2) ответь на сообщение с логом и отправь /render_log_set",
  ].join("\n");
}

export async function handleRenderLogSet({
  bot,
  chatId,
  senderIdStr,
  rest,
  bypass,
  msg,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const inlineText = extractInlineText(rest);
  const replyText = extractReplyText(msg);
  const logText = inlineText || replyText;

  if (!logText) {
    await bot.sendMessage(chatId, buildUsageText());
    return;
  }

  const result = renderLogInbox.setLatest({
    chatId: String(chatId),
    senderIdStr: String(senderIdStr || ""),
    logText,
    source: "telegram_manual",
  });

  if (!result?.ok) {
    await bot.sendMessage(chatId, "⚠️ Не удалось сохранить log snapshot.");
    return;
  }

  await bot.sendMessage(
    chatId,
    [
      "✅ Последний log snapshot сохранён.",
      `chars=${result.entry.chars}`,
      `updatedAt=${result.entry.updatedAt}`,
      "Теперь можно отправить /render_diag_last",
    ].join("\n")
  );
}

export default {
  handleRenderLogSet,
};