// src/bot/handlers/sourcesDiag.js
// extracted from case "/sources_diag" — no logic changes

import { runSourceDiagnosticsOnce } from "../../sources/diagnostics.js";

export async function handleSourcesDiag({
  bot,
  chatId,
  userRole,
  userPlan,
  bypass,
}) {
  const summary = await runSourceDiagnosticsOnce({
    userRole,
    userPlan,
    bypassPermissions: bypass,
  });

  const textDiag =
    `🩺 Диагностика источников\n` +
    `Всего: ${summary.total}\n` +
    `OK: ${summary.okCount}\n` +
    `Ошибок: ${summary.failCount}`;

  await bot.sendMessage(chatId, textDiag);
  return;
}

