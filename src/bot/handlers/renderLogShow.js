// src/bot/handlers/renderLogShow.js
// Handler for /render_log_show — show latest saved render log snapshot metadata + preview.

import renderLogInbox from "../../logging/RenderLogInbox.js";

function cutText(value, max = 1200) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

export async function handleRenderLogShow({
  bot,
  chatId,
  senderIdStr,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const inboxEntry = await renderLogInbox.getLatest({
    chatId: String(chatId),
    senderIdStr: String(senderIdStr || ""),
  });

  if (!inboxEntry?.logText) {
    await bot.sendMessage(
      chatId,
      [
        "⚠️ Последний log snapshot не найден.",
        "Сначала отправь /render_log_set с логом",
        "или ответь на сообщение с логом и отправь /render_log_set",
      ].join("\n")
    );
    return;
  }

  const preview = cutText(inboxEntry.logText, 1600);

  const output = [
    "🧾 Render log snapshot",
    "",
    `source=${inboxEntry.source || "unknown"}`,
    `savedAt=${inboxEntry.updatedAt || "unknown"}`,
    `chars=${inboxEntry.chars || 0}`,
    "",
    "preview:",
    preview || "(empty)",
  ].join("\n");

  await sendChunked(bot, chatId, output);
}

export default {
  handleRenderLogShow,
};