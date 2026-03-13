// src/bot/router/repoCheckCommand.js

export async function handleRepoCheckCommand({
  handleRepoCheck,
  bot,
  chatId,
  rest,
}) {
  await handleRepoCheck({
    bot,
    chatId,
    rest,
  });
}