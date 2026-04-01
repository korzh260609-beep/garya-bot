// src/core/handleMessage/handleCommandFlow.js

import { ensureCommandInvocation } from "./commandFlow/commandInvocation.js";
import { logInboundCommandMessage } from "./commandFlow/commandInboundLogging.js";
import { handleCommandRateLimitAndPermission } from "./commandFlow/commandAccessGuards.js";
import { handleBuiltInCommand } from "./commandFlow/commandBuiltins.js";
import { handleCommandDiagnostics } from "./commandFlow/commandDiagnostics.js";
import { dispatchCommandBridge } from "./commandFlow/dispatchCommandBridge.js";

export async function handleCommandFlow({
  context,
  deps,
  transport,
  chatIdStr,
  chatIdNum,
  chatType,
  globalUserId,
  senderId,
  messageId,
  raw,
  trimmed,
  rest,
  cmdBase,
  user,
  userRole,
  userPlan,
  isMonarchUser,
  isPrivateChat,
  canProceed,
  replyAndLog,
}) {
  const invocationResult = await ensureCommandInvocation({
    transport,
    chatIdStr,
    messageId,
    cmdBase,
    globalUserId,
    senderId,
  });

  if (invocationResult?.shouldReturn) {
    return invocationResult.response;
  }

  await logInboundCommandMessage({
    transport,
    chatIdStr,
    chatType,
    globalUserId,
    senderId,
    messageId,
    raw,
    trimmed,
    cmdBase,
    commandInvocationInserted: invocationResult.commandInvocationInserted,
  });

  const guardResult = await handleCommandRateLimitAndPermission({
    transport,
    chatIdStr,
    globalUserId,
    senderId,
    cmdBase,
    userRole,
    userPlan,
    isMonarchUser,
    canProceed,
    replyAndLog,
  });

  if (guardResult?.handled) {
    return guardResult.response;
  }

  const builtInResult = await handleBuiltInCommand({
    cmdBase,
    replyAndLog,
  });

  if (builtInResult?.handled) {
    return builtInResult.response;
  }

  const diagnosticResult = await handleCommandDiagnostics({
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

  if (diagnosticResult?.handled) {
    return diagnosticResult.response;
  }

  const dispatchResult = await dispatchCommandBridge({
    deps,
    cmdBase,
    chatIdNum,
    chatIdStr,
    senderId,
    rest,
    user,
    userRole,
    userPlan,
    isMonarchUser,
    globalUserId,
    transport,
    chatType,
    messageId,
    isPrivateChat,
    replyAndLog,
    raw,
  });

  if (dispatchResult?.handled) {
    return dispatchResult.response;
  }

  return { ok: true, stage: "6.logic.2", result: "unknown_command", cmdBase };
}