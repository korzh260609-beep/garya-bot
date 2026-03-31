// src/bot/handlers/source.js
// aligned with injected fetchFromSourceKey dependency

export async function handleSource({
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
    await bot.sendMessage(chatId, "Использование: /source <key>");
    return;
  }

  const result = await fetchFromSourceKey(key, {
    userRole,
    userPlan,
  });

  if (!result?.ok) {
    await bot.sendMessage(
      chatId,
      `❌ Ошибка при обращении к источнику <code>${key}</code>:\n<code>${
        result?.error || "Unknown error"
      }</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    JSON.stringify(
      {
        ok: result.ok,
        sourceKey: result.sourceKey,
        type: result.type,
        httpStatus: result.httpStatus,
        fromCache: result.fromCache === true,
        data: result.data,
      },
      null,
      2
    ).slice(0, 3500)
  );
}