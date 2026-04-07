// src/bot/handlers/chat/chatAiMemoryPrepFlow.js

import pool from "../../../../db.js";
import { getMemoryService } from "../../../core/memoryServiceFactory.js";
import {
  resolveUserTimezoneState,
  tryHandleMissingTimezoneFlow,
  tryHandleDeterministicTimeReplies,
} from "./timezoneFlow.js";
import { buildChatRecallContext } from "./recallFlow.js";
import { runAlreadySeenFlow } from "./alreadySeenFlow.js";

export async function runChatAiMemoryPrep({
  bot,
  chatId,
  chatIdStr,
  globalUserId = null,
  userRole = "guest",
  effective,
  currentChatType = "unknown",
  stablePersonalFactMode = false,
  historyLimit = 20,
  insertAssistantReply,
  saveAssistantEarlyReturn,
}) {
  let history = [];
  let recallCtx = null;

  const { userTz, timezoneMissing } = await resolveUserTimezoneState(globalUserId);

  if (timezoneMissing) {
    const result = await tryHandleMissingTimezoneFlow({
      effective,
      globalUserId,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });
    if (result?.handled) {
      return {
        handled: true,
        history,
        recallCtx,
        userTz,
      };
    }
  }

  if (!stablePersonalFactMode) {
    try {
      const memoryLocal = getMemoryService();
      history = await memoryLocal.recent({
        chatId: chatIdStr,
        globalUserId,
        limit: historyLimit,
        chatType: currentChatType,
      });
    } catch {}

    recallCtx = await buildChatRecallContext({
      pool,
      chatIdStr,
      globalUserId,
      effective,
      userTz,
    });

    const deterministicResult = await tryHandleDeterministicTimeReplies({
      effective,
      userTz,
      recallCtx,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });

    if (deterministicResult?.handled) {
      return {
        handled: true,
        history,
        recallCtx,
        userTz,
      };
    }

    await runAlreadySeenFlow({
      bot,
      chatId,
      chatIdStr,
      globalUserId,
      effective,
      userRole,
      saveAssistantHint: async (hintText) => {
        await insertAssistantReply(hintText, {
          stage: "already_seen",
        });
      },
    });
  }

  return {
    handled: false,
    history,
    recallCtx,
    userTz,
  };
}

export default {
  runChatAiMemoryPrep,
};
