// src/bot/router/routerCommandContext.js

import { getMemoryService } from "../core/memoryServiceFactory.js";
import { buildRequirePermOrReply } from "../permGuard.js";
import { ctxReplyCommand } from "./ctxReplyCommand.js";

export function createRouterCommandContext({
  bot,
  msg,
  chatId,
  chatIdStr,
  MONARCH_USER_ID,
  user,
  userRole,
  userPlan,
  trimmed,
  CMD_ACTION,
  globalUserId,
}) {
  const memory = getMemoryService();

  const ctxReply = async (text, meta) => {
    return ctxReplyCommand({
      bot,
      chatId,
      chatIdStr,
      msg,
      memory,
      globalUserId,
      text,
      meta: meta && typeof meta === "object" ? meta : {},
    });
  };

  const requirePermOrReply = buildRequirePermOrReply({
    bot,
    msg,
    MONARCH_USER_ID,
    user,
    userRole,
    userPlan,
    trimmed,
    CMD_ACTION,
  });

  return {
    memory,
    ctxReply,
    requirePermOrReply,
  };
}