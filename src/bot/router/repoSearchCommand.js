// src/bot/router/repoSearchCommand.js

export async function handleRepoSearchCommand({
  handleRepoSearch,
  bot,
  chatId,
  rest,
}) {
  await handleRepoSearch({
    bot,
    chatId,
    rest,
  });
}