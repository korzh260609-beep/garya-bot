// src/bot/router/diagSourceCommand.js

export async function handleDiagSourceCommand({
  handleDiagSource,
  bot,
  chatId,
  chatIdStr,
  rest,
  diagnoseSource,
}) {
  await handleDiagSource({
    bot,
    chatId,
    chatIdStr,
    rest,
    diagnoseSource,
  });
}