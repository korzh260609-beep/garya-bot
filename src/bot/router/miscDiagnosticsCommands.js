// src/bot/router/miscDiagnosticsCommands.js

export async function handleMiscDiagnosticsCommands({
  cmdBase,
  handleApproveCommand,
  handleDenyCommand,
  handleBehaviorEventsLastCommand,
  handleChatMessagesDiagCommand,
  handleTasksOwnerDiagCommand,
  handleApprove,
  handleDeny,
  handleBehaviorEventsLast,
  handleChatMessagesDiag,
  bot,
  chatId,
  chatIdStr,
  rest,
  senderIdStr,
  globalUserId,
  isPrivate,
  pool,
  ctxReply,
}) {
  if (cmdBase === "/approve") {
    await handleApproveCommand({
      handleApprove,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/deny") {
    await handleDenyCommand({
      handleDeny,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/behavior_events_last") {
    await handleBehaviorEventsLastCommand({
      handleBehaviorEventsLast,
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/chat_messages_diag") {
    await handleChatMessagesDiagCommand({
      handleChatMessagesDiag,
      bot,
      chatId,
      chatIdStr,
      senderIdStr,
      globalUserId,
      isPrivateChat: isPrivate,
    });
    return true;
  }

  if (cmdBase === "/tasks_owner_diag") {
    await handleTasksOwnerDiagCommand({
      pool,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  return false;
}