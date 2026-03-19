// src/bot/handlers/prices.js
// extracted from commandDispatcher case "/prices" — keep behavior identical

export async function handlePrices({
  bot,
  chatId,
  rest,
  getCoinGeckoSimplePriceMulti,
  userRole,
  userPlan,
  bypass,
}) {
  if (typeof rest !== "string") return { handled: false };
  if (typeof getCoinGeckoSimplePriceMulti !== "function") return { handled: false };

  const raw = rest.trim();
  if (!raw) {
    await bot.sendMessage(
      chatId,
      "Использование: /prices <coinId,coinId,...>\nПример: /prices bitcoin,ethereum,solana"
    );
    return { handled: true };
  }

  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 25);

  if (!ids.length) {
    await bot.sendMessage(chatId, "⚠️ Не нашёл coinId. Пример: /prices bitcoin,ethereum");
    return { handled: true };
  }

  const result = await getCoinGeckoSimplePriceMulti(ids, "usd", {
    userRole,
    userPlan,
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

  const itemsObj =
    result.items && typeof result.items === "object" && !Array.isArray(result.items)
      ? result.items
      : {};

  const lines = Object.entries(itemsObj).map(([requestedId, it]) => {
    const label = String(it?.id || requestedId || "").toUpperCase();
    return `• ${label}: $${it?.price}`;
  });

  await bot.sendMessage(
    chatId,
    lines.length ? `💰 Цены:\n${lines.join("\n")}` : "⚠️ Нет данных по этим coinId."
  );

  return { handled: true };
}