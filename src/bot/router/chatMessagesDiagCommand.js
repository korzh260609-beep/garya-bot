// src/bot/router/chatMessagesDiagCommand.js

export async function handleChatMessagesDiagCommand({
  handleChatMessagesDiag,
  bot,
  chatId,
  chatIdStr,
  senderIdStr,
  globalUserId,
  isPrivateChat,
}) {
  await handleChatMessagesDiag({
    bot,
    chatId,
    chatIdStr,
    senderIdStr,
    globalUserId,
    isPrivateChat,
  });
}