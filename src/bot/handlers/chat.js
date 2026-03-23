// src/bot/handlers/chat.js

import buildChatMessages from "./chat/promptAssembly.js";
import isStablePersonalFactQuestion
  from "./chat/isStablePersonalFactQuestion.js";

import { buildChatRecallContext } from "./chat/recallContext.js";
import { tryHandleDeterministicTimeReplies }
  from "./chat/deterministicTime.js";
import { runAlreadySeenFlow }
  from "./chat/alreadySeen.js";

export default async function handleChat(ctx) {
  const { effectiveText } = ctx;

  // ------------------------------
  // 1️⃣ EARLY stable personal fact detection
  // ------------------------------

  const stablePersonalFactMode =
    isStablePersonalFactQuestion(effectiveText);

  if (stablePersonalFactMode) {
    const messages = await buildChatMessages({
      ...ctx,
      stablePersonalFactMode: true,
      skipRecall: true,
      skipAlreadySeen: true,
      skipDeterministic: true,
    });

    return {
      type: "ai",
      messages,
      meta: {
        stablePersonalFactMode: true,
      },
    };
  }

  // ------------------------------
  // 2️⃣ Deterministic time replies
  // ------------------------------

  const deterministicReply =
    await tryHandleDeterministicTimeReplies(ctx);

  if (deterministicReply) {
    return deterministicReply;
  }

  // ------------------------------
  // 3️⃣ Recall context
  // ------------------------------

  await buildChatRecallContext(ctx);

  // ------------------------------
  // 4️⃣ Already seen flow
  // ------------------------------

  const alreadySeenReply =
    await runAlreadySeenFlow(ctx);

  if (alreadySeenReply) {
    return alreadySeenReply;
  }

  // ------------------------------
  // 5️⃣ Default AI flow
  // ------------------------------

  const messages = await buildChatMessages({
    ...ctx,
    stablePersonalFactMode: false,
  });

  return {
    type: "ai",
    messages,
    meta: {
      stablePersonalFactMode: false,
    },
  };
}