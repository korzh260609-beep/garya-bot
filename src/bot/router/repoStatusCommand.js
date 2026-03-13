// src/bot/router/repoStatusCommand.js

export async function handleRepoStatusCommand({
  handleRepoStatus,
  bot,
  chatId,
  senderIdStr,
}) {
  await handleRepoStatus({
    bot,
    chatId,
    senderIdStr,
  });
}