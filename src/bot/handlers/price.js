// src/bot/handlers/price.js
// extracted from commandDispatcher case "/price" — keep behavior identical

export async function handlePrice({ bot, chatId, rest, getCoinGeckoSimplePriceById, userRole, userPlan, bypass }) {
  if (typeof rest !== "string") return { handled: false };
  if (typeof getCoinGeckoSimplePriceById !== "function") return { handled: false };

  const coinId = rest.trim().toLowerCase();

  if (!coinId) {
    await bot.sendMessage(chatId, "Использование: /price <coinId>\nПример: /price bitcoin");
    return { handled: true };
  }

  const result = await getCoinGeckoSimplePriceById(coinId, "usd", {
    userRole,
    userPlan,
    bypassPermissions: bypass,
  });

  if (!result.ok) {
    const err = String(result.error || "");
    if (result.httpStatus === 429 || err.includes("429")) {
      await bot.sendMessage(chatId, "⚠️ CoinGecko вернул лимит (429). Попробуй через 1–2 минуты.");
    } else {
      await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
    }
    return { handled: true };
  }

  await bot.sendMessage(chatId, `💰 ${result.id.toUpperCase()}: $${result.price}`);
  return { handled: true };
}

