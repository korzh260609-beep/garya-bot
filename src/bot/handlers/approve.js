// src/bot/handlers/approve.js

import { approveAndNotify } from "../users/accessRequests.js";

export async function handleApprove({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /approve <request_id>");
    return;
  }

  try {
    const res = await approveAndNotify({
      bot,
      chatId,
      chatIdStr,
      requestId: id,
    });

    if (!res?.ok) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не удалось approve: ${res?.error || "unknown"}`
      );
    }
  } catch (e) {
    console.error("❌ /approve error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при approve.");
  }
}
