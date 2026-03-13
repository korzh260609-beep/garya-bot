// src/bot/router/repoTreeCommand.js

export async function handleRepoTreeCommand({
  handleRepoTree,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  await handleRepoTree({
    bot,
    chatId,
    rest,
    senderIdStr,
  });
}