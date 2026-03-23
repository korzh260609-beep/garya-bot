// src/bot/handlers/chat/longTermMemoryBridge.js

import buildLongTermMemoryPromptBridge from "../../../core/buildLongTermMemoryPromptBridge.js";
import buildLongTermPromptSelector from "../../../core/buildLongTermPromptSelector.js";

export async function resolveLongTermMemoryBridge({
  chatIdStr,
  globalUserId,
  memory,
}) {
  let longTermMemoryBridgeResult = null;
  let longTermMemorySystemMessage = null;
  let longTermMemoryInjected = false;

  try {
    const selector = buildLongTermPromptSelector({
      rememberTypes: [
        "user_profile",
        "vehicle_profile",
        "maintenance_fact",
        "maintenance_interval",
        "task_intent",
      ],
      rememberKeys: ["communication_style"],
      perTypeLimit: 3,
      perKeyLimit: 3,
      totalLimit: 12,
    });

    longTermMemoryBridgeResult = await buildLongTermMemoryPromptBridge({
      chatId: chatIdStr,
      globalUserId,
      rememberTypes: selector.rememberTypes,
      rememberKeys: selector.rememberKeys,
      perTypeLimit: selector.perTypeLimit,
      perKeyLimit: selector.perKeyLimit,
      totalLimit: selector.totalLimit,
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