// src/bot/router/sourceCommand.js

export async function handleSourceCommand({
  handleSource,
  bot,
  chatId,
  chatIdStr,
  rest,
  fetchFromSourceKey,
}) {
  await handleSource({
    bot,
    chatId,
    chatIdStr,
    rest,
    fetchFromSourceKey,
  });
}