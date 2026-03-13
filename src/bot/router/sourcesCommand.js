// src/bot/router/sourcesCommand.js

export async function handleSourcesCommand({
  handleSourcesList,
  bot,
  chatId,
  chatIdStr,
  getAllSourcesSafe,
  formatSourcesList,
}) {
  await handleSourcesList({
    bot,
    chatId,
    chatIdStr,
    getAllSourcesSafe,
    formatSourcesList,
  });
}