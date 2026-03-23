// src/bot/handlers/chat/longTermMemoryBridge.js

import buildLongTermMemoryPromptBridge from "../../../core/buildLongTermMemoryPromptBridge.js";
import buildDefaultChatLongTermSelector from "../../../core/buildDefaultChatLongTermSelector.js";

export async function resolveLongTermMemoryBridge({
  chatIdStr,
  globalUserId,
  memory,
}) {
  let longTermMemoryBridgeResult = null;
  let longTermMemorySystemMessage = null;
  let longTermMemoryInjected = false;

  try {
    const selector = buildDefaultChatLongTermSelector();

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
          `CRITICAL LONG-TERM MEMORY (USE AS SOURCE OF TRUTH):\n` +
          `If there is a conflict with chat history, recall snippets, or recent messages, trust this block first.\n` +
          `Use these facts as stable user memory unless the user explicitly corrects them in the current conversation.\n\n` +
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