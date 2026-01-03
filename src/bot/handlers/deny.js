// src/bot/handlers/deny.js

import { denyAndNotify } from "../../users/accessRequests.js";

export async function handleDeny({
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
    await bot.sendMessage(chatId, "Использование: /deny <request_id>");
    return;
  }

  try {
    const res = await denyAndNotify({
      bot,
      chatId,
      chatIdStr,
      requestId: id,
    });

    if (!res?.ok) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не удалось deny: ${res?.error || "unknown"}`
      );
    }
  } catch (e) {
    console.error("❌ /deny error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при deny.");
  }
}
