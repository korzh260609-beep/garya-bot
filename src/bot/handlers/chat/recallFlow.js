// src/bot/handlers/chat/recallFlow.js

import { getRecallEngine } from "../../../core/recallEngineFactory.js";

export async function buildChatRecallContext({
  pool,
  chatIdStr,
  globalUserId,
  effective,
  userTz,
}) {
  let recallCtx = "";

  try {
    const recall = getRecallEngine({ db: pool, logger: console });
    recallCtx = await recall.buildRecallContext({
      chatId: chatIdStr,
      globalUserId,
      query: effective,
      limit: 10,
      userTimezone: userTz,
    });
  } catch (e) {
    console.error("ERROR RecallEngine buildRecallContext failed (fail-open):", e);
  }

  return recallCtx;
}