// src/bot/handlers/pmShow.js
// extracted from case "/pm_show" — minimal safe change: Telegram chunking (no architecture changes)

import {
  TELEGRAM_SAFE_TEXT_LIMIT,
  chunkTelegramTextWithPrefix,
} from "../telegram/telegramTextUtils.js";

export async function handlePmShow({
  bot,
  chatId,
  rest,
  getProjectSection,
}) {
  const section = (rest || "").trim();
  if (!section) {
    await bot.sendMessage(chatId, "Использование: /pm_show <section>");
    return;
  }

  try {
    const rec = await getProjectSection(undefined, section);
    if (!rec) {
      await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
      return;
    }

    const content = String(rec.content || "");
    const headerBase = `🧠 Project Memory: ${rec.section}\n\n`;

    // If everything fits in one message — send once.
    if ((headerBase.length + content.length) <= TELEGRAM_SAFE_TEXT_LIMIT) {
      await bot.sendMessage(chatId, headerBase + content);
      return;
    }

    const messages = chunkTelegramTextWithPrefix({
      text: content,
      limit: TELEGRAM_SAFE_TEXT_LIMIT,
      minChunkSize: 500,
      prefixBuilder: (partIndex, totalParts) =>
        `🧠 Project Memory: ${rec.section}\n` +
        `часть ${partIndex}/${totalParts}\n\n`,
    });

    for (const message of messages) {
      await bot.sendMessage(chatId, message);
    }
  } catch (e) {
    console.error("❌ /pm_show error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory.");
  }
}
