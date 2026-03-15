// src/bot/router/memoryDiagnosticsCommands.js

export async function handleMemoryDiagnosticsCommands({
  cmdBase,
  handleMemoryStatusCommand,
  handleMemoryDiagCommand,
  handleMemoryIntegrityCommand,
  handleMemoryBackfillCommand,
  handleMemoryUserChatsCommand,
  handleChatDiagCommand,
  memory,
  memDiag,
  accessPack,
  chatIdStr,
  rest,
  ctxReply,
  getPublicEnvSnapshot,
  pool,
}) {
  if (cmdBase === "/memory_status") {
    await handleMemoryStatusCommand({
      memory,
      memDiag,
      ctxReply,
      getPublicEnvSnapshot,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/memory_diag") {
    await handleMemoryDiagCommand({
      accessPack,
      memDiag,
      chatIdStr,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/memory_integrity") {
    await handleMemoryIntegrityCommand({
      memDiag,
      chatIdStr,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/memory_backfill") {
    await handleMemoryBackfillCommand({
      accessPack,
      memDiag,
      chatIdStr,
      rest,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/memory_user_chats") {
    await handleMemoryUserChatsCommand({
      accessPack,
      memDiag,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  if (cmdBase === "/chat_diag") {
    await handleChatDiagCommand({
      pool,
      ctxReply,
      cmdBase,
    });
    return true;
  }

  return false;
}