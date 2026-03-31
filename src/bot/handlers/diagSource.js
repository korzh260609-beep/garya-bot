// src/bot/handlers/diagSource.js
// aligned with diagnoseSource(key, options)

export async function handleDiagSource({
  bot,
  chatId,
  rest,
  userRole,
  userPlan,
  bypass,
  diagnoseSource,
}) {
  const key = (rest || "").trim();

  if (!key) {
    await bot.sendMessage(chatId, "Использование: /diag_source <source_key>");
    return;
  }

  const result = await diagnoseSource(key, {
    userRole,
    userPlan,
    ignoreRateLimit: false,
  });

  const lines = [
    `🩺 Диагностика источника: ${key}`,
    `ok: ${result?.ok === true ? "yes" : "no"}`,
    `type: ${result?.type || "unknown"}`,
    `httpStatus: ${
      typeof result?.httpStatus === "number" ? result.httpStatus : "n/a"
    }`,
    `fromCache: ${result?.fromCache === true ? "yes" : "no"}`,
  ];

  if (!result?.ok) {
    lines.push(`error: ${result?.error || "unknown"}`);
  }

  await bot.sendMessage(chatId, lines.join("\n"));
}