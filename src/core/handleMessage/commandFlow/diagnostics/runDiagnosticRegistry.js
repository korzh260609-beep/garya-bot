// src/core/handleMessage/commandFlow/diagnostics/runDiagnosticRegistry.js

import { dispatchDiagnosticCommand } from "../../../diagnostics/index.js";

export async function runDiagnosticRegistry({
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
  try {
    const diagnosticResult = await dispatchDiagnosticCommand({
      cmdBase,
      context,
      deps,
      user,
      userRole,
      userPlan,
      isMonarchUser,
      isPrivateChat,
      globalUserId,
      chatIdStr,
      chatIdNum,
      senderId,
      messageId,
      chatType,
      transport,
      trimmed,
      rest,
      replyAndLog,
    });

    if (diagnosticResult?.handled) {
      return {
        handled: true,
        response: diagnosticResult,
      };
    }
  } catch (e) {
    console.error("handleMessage(dispatchDiagnosticCommand) failed:", e);
  }

  return { handled: false };
}