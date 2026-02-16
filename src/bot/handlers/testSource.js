// src/bot/handlers/testSource.js
// extracted from case "/test_source" — no logic changes

export async function handleTestSource({
  bot,
  chatId,
  rest,
  fetchFromSourceKey,
  userRole,
  userPlan,
  bypass,
}) {
  const key = (rest || "").trim();
  if (!key) {
    await bot.sendMessage(chatId, "Использование: /test_source <source_key>");
    return;
  }

  const result = await fetchFromSourceKey(key, {
    userRole,
    userPlan,
  });

  if (!result || result.error) {
    await bot.sendMessage(chatId, `❌ Ошибка источника: ${result?.error || "unknown"}`);
    return;
  }

  await bot.sendMessage(chatId, "✅ Источник работает.");
}

