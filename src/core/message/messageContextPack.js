// src/core/message/messageContextPack.js
// SG 2.0 — Message Context Pack Runtime Bridge Preparation
//
// Purpose:
// - Prepare a controlled Memory/Context pack for normal message AI requests.
// - Keep this bridge transport-independent and side-effect free.
// - Do not inject context into the AI prompt here yet.
//
// Hard rules:
// - No DB reads/writes.
// - No Telegram or transport logic.
// - No source fetching.
// - No AI calls.
// - No repository writes.
// - This file only builds a context pack from already available runtime inputs.

import { buildContextPack } from "../../memory/index.js";

function buildTaskIntent(text = "") {
  const safeText = typeof text === "string" ? text.trim() : "";

  if (!safeText) {
    return null;
  }

  return "normal_message_ai_request";
}

export function buildMessageContextPack({ identity = {}, text = "", behaviorRuntime = null } = {}) {
  const globalUserId = identity?.globalUserId || null;
  const platformUserId = identity?.platformUserId || null;

  return buildContextPack({
    userId: globalUserId,
    chatId: null,
    userMessage: text,
    userIdentity: {
      globalUserId,
      platform: identity?.platform || "unknown",
      platformUserId,
      role: identity?.role || "guest",
      displayName: identity?.displayName || null,
      isMonarch: Boolean(identity?.isMonarch),
    },
    taskIntent: buildTaskIntent(text),
    sessionContext: behaviorRuntime
      ? [
          {
            content: "Message behavior runtime was evaluated before AI call.",
            source: "core_message_behavior_runtime",
            metadata: {
              hasBehaviorRuntime: true,
              mode: behaviorRuntime?.mode || null,
            },
          },
        ]
      : [],
    limits: {
      maxItems: 10,
      maxChars: 1200,
    },
  });
}

export default {
  buildMessageContextPack,
};
