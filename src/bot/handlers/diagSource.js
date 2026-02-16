// src/bot/handlers/diagSource.js
// extracted from case "/diag_source" — no logic changes

export async function handleDiagSource({
  bot,
  chatId,
  rest,
  userRole,
  userPlan,
  bypass,
  runSourceDiagnosticsOnce,
}) {
  const key = (rest || "").trim();
  if (!key) {
    await bot.sendMessage(chatId, "Использование: /diag_source <source_key>");
    return;
  }

  const summary = await runSourceDiagnosticsOnce({
    sourceKey: key,
    userRole,
    userPlan,
  });

  const out =
    `🩺 Диагностика источника: ${key}\n` +
    `Всего: ${summary.total}\n` +
    `OK: ${summary.okCount}\n` +
    `Ошибок: ${summary.failCount}`;

  await bot.sendMessage(chatId, out);
}

