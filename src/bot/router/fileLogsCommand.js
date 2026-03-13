// src/bot/router/fileLogsCommand.js

export async function handleFileLogsCommand({
  handleFileLogs,
  bot,
  chatId,
  chatIdStr,
  rest,
}) {
  await handleFileLogs({
    bot,
    chatId,
    chatIdStr,
    rest,
  });
}