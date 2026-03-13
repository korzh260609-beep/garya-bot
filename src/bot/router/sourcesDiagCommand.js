// src/bot/router/sourcesDiagCommand.js

export async function handleSourcesDiagCommand({
  handleSourcesDiag,
  bot,
  chatId,
  chatIdStr,
  rest,
  runSourceDiagnosticsOnce,
}) {
  await handleSourcesDiag({
    bot,
    chatId,
    chatIdStr,
    rest,
    runSourceDiagnosticsOnce,
  });
}