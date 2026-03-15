// src/bot/router/contextDebugCommands.js

export async function handleContextDebugCommands({
  cmdBase,
  dispatchCommand,
  bot,
  msg,
  identityCtx,
  chatId,
  chatIdStr,
  senderIdStr,
  chatType,
  isPrivate,
  rest,
  userRole,
  userPlan,
  user,
  isMonarchUser,
  ctxReply,
}) {
  if (cmdBase === "/chat_meta_debug") {
    await dispatchCommand(cmdBase, {
      bot,
      msg,
      identityCtx,
      chatId,
      chatIdStr,
      senderIdStr,
      chatType,
      isPrivateChat: isPrivate,
      rest,
      userRole,
      userPlan,
      user,
      bypass: isMonarchUser,
      reply: ctxReply,
    });
    return true;
  }

  if (cmdBase === "/recall") {
    await dispatchCommand(cmdBase, {
      bot,
      msg,
      identityCtx,
      chatId,
      chatIdStr,
      senderIdStr,
      chatType,
      isPrivateChat: isPrivate,
      rest,
      userRole,
      userPlan,
      user,
      bypass: isMonarchUser,
      reply: ctxReply,
    });
    return true;
  }

  return false;
}