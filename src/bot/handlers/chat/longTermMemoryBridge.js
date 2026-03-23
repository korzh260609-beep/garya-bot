// src/bot/handlers/chat/longTermMemoryBridge.js

import buildLongTermMemoryPromptBridge from "../../../core/buildLongTermMemoryPromptBridge.js";

export async function resolveLongTermMemoryBridge({
  chatIdStr,
  globalUserId,
  memory,
}) {
  let longTermMemoryBridgeResult = null;
  let longTermMemorySystemMessage = null;
  let longTermMemoryInjected = false;

  try {
    longTermMemoryBridgeResult = await buildLongTermMemoryPromptBridge({
      chatId: chatIdStr,
      globalUserId,
      rememberTypes: [
        "user_profile",
        "vehicle_profile",
        "maintenance_fact",
        "maintenance_interval",
        "task_intent",
        "project_rule",
      ],
      rememberKeys: [],
      perTypeLimit: 3,
      perKeyLimit: 3,
      totalLimit: 12,
      header: "LONG_TERM_MEMORY",
      maxItems: 12,
      maxValueLength: 180,
      memoryService: memory,
    });

    longTermMemoryInjected = Boolean(
      longTermMemoryBridgeResult?.ok === true && longTermMemoryBridgeResult?.block
    );

    if (longTermMemoryInjected) {
      longTermMemorySystemMessage = {
        role: "system",
        content:
          `LONG-TERM MEMORY (deterministic selected context):\n` +
          `${longTermMemoryBridgeResult.block}`,
      };
    }
  } catch (e) {
    console.error("ERROR long-term memory bridge prep failed (fail-open):", e);
    longTermMemoryBridgeResult = null;
    longTermMemorySystemMessage = null;
    longTermMemoryInjected = false;
  }

  return {
    longTermMemoryBridgeResult,
    longTermMemorySystemMessage,
    longTermMemoryInjected,
  };
}