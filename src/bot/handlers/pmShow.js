// src/bot/handlers/pmShow.js
// extracted from case "/pm_show" — minimal safe change: Telegram chunking (no architecture changes)

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

  // Telegram hard limit is 4096 chars. Keep safe margin for prefixes.
  const SAFE_LIMIT = 3800;

  // Split helper that accounts for per-part header length.
  function chunkText(text, limit) {
    const s = String(text || "");
    if (!s) return [""];

    const parts = [];
    let i = 0;

    while (i < s.length) {
      parts.push(s.slice(i, i + limit));
      i += limit;
    }

    return parts;
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
    if ((headerBase.length + content.length) <= SAFE_LIMIT) {
      await bot.sendMessage(chatId, headerBase + content);
      return;
    }

    // Multi-part: first part includes base header + "часть i/N"
    // We must reserve space for the per-part prefix.
    // Example prefix: "🧠 Project Memory: X\nчасть 1/12\n\n"
    const chunks = chunkText(content, SAFE_LIMIT); // temporary, will be re-chunked with exact prefix size
    const total = chunks.length;

    // Re-chunk with accurate per-part prefix sizing.
    const finalParts = [];
    let cursor = 0;

    for (let partIndex = 1; cursor < content.length; partIndex++) {
      const partPrefix =
        `🧠 Project Memory: ${rec.section}\n` +
        `часть ${partIndex}/${Math.max(1, total)}\n\n`;

      const available = Math.max(500, SAFE_LIMIT - partPrefix.length); // safety floor
      finalParts.push(content.slice(cursor, cursor + available));
      cursor += available;
    }

    const finalTotal = finalParts.length;

    for (let idx = 0; idx < finalTotal; idx++) {
      const partPrefix =
        `🧠 Project Memory: ${rec.section}\n` +
        `часть ${idx + 1}/${finalTotal}\n\n`;

      await bot.sendMessage(chatId, partPrefix + finalParts[idx]);
    }
  } catch (e) {
    console.error("❌ /pm_show error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory.");
  }
}