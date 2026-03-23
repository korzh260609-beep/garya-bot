// src/core/handleMessage/commandFlow/dispatchCommandBridge.js

import { buildDispatchCommandContext } from "../contextBuilders.js";

export async function dispatchCommandBridge({
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
}) {
  if (typeof deps?.dispatchCommand !== "function") {
    return { handled: false };
  }

  try {
    const dispatchCtx = buildDispatchCommandContext({
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
    });

    const result = await deps.dispatchCommand(cmdBase, dispatchCtx);
    if (result?.handled) {
      return {
        handled: true,
        response: { ok: true, stage: "6.logic.2", result: "command_handled", cmdBase },
      };
    }
  } catch (e) {
    console.error("handleMessage(dispatchCommand) failed:", e);
    await replyAndLog("⛔ Ошибка при выполнении команды.", {
      cmd: cmdBase,
      event: "dispatch_error",
    });

    return {
      handled: true,
      response: { ok: false, reason: "dispatch_error", cmdBase },
    };
  }

  return { handled: false };
}