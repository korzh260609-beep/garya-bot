import { runSourceDiagnosticsOnce } from "../../sources/sources.js";

export async function handleSourcesDiag(ctx) {
  const { bot, chatId, userRole, userPlan, bypass } = ctx;

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
}

