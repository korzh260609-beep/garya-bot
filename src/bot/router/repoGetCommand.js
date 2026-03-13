// src/bot/router/repoGetCommand.js

export async function handleRepoGetCommand({
  handleRepoGet,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  await handleRepoGet({
    bot,
    chatId,
    rest,
    senderIdStr,
  });
}