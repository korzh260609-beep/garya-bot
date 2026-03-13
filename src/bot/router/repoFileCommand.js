// src/bot/router/repoFileCommand.js

export async function handleRepoFileCommand({
  handleRepoFile,
  bot,
  chatId,
  rest,
}) {
  await handleRepoFile({
    bot,
    chatId,
    rest,
  });
}