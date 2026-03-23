// src/core/handleMessage/commandFlow/commandDiagnostics.js

import { runDiagnosticRegistry } from "./diagnostics/runDiagnosticRegistry.js";
import { handleChatMessagesDiag } from "./diagnostics/handleChatMessagesDiag.js";

export async function handleCommandDiagnostics({
  context,
  deps,
  transport,
  chatIdStr,
  chatIdNum,
  chatType,
  globalUserId,
  senderId,
  messageId,
  trimmed,
  rest,
  cmdBase,
  user,
  userRole,
  userPlan,
  isMonarchUser,
  isPrivateChat,
  replyAndLog,
}) {
  const registryResult = await runDiagnosticRegistry({
    context,
    deps,
    transport,
    chatIdStr,
    chatIdNum,
    chatType,
    globalUserId,
    senderId,
    messageId,
    trimmed,
    rest,
    cmdBase,
    user,
    userRole,
    userPlan,
    isMonarchUser,
    isPrivateChat,
    replyAndLog,
  });

  if (registryResult?.handled) {
    return registryResult;
  }

  return handleChatMessagesDiag({
    cmdBase,
    chatIdStr,
    globalUserId,
    isMonarchUser,
    isPrivateChat,
    replyAndLog,
  });
}