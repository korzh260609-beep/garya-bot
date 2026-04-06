// src/bot/handlers/chat/longTermMemoryBridge.js

import buildLongTermMemoryPromptBridge from "../../../core/buildLongTermMemoryPromptBridge.js";
import buildDefaultChatLongTermSelector from "../../../core/buildDefaultChatLongTermSelector.js";

export async function resolveLongTermMemoryBridge({
  chatIdStr,
  globalUserId,
  memory,
  effective = "",
}) {
  let longTermMemoryBridgeResult = null;
  let longTermMemorySystemMessage = null;
  let longTermMemoryInjected = false;

  try {
    const selector = buildDefaultChatLongTermSelector({ effective });

    longTermMemoryBridgeResult = await buildLongTermMemoryPromptBridge({
      chatId: chatIdStr,
      globalUserId,
      rememberTypes: selector.rememberTypes,
      rememberKeys: selector.rememberKeys,
      rememberDomains: selector.rememberDomains,
      rememberSlots: selector.rememberSlots,
      domainSlots: selector.domainSlots,
      perTypeLimit: selector.perTypeLimit,
      perKeyLimit: selector.perKeyLimit,
      perDomainLimit: selector.perDomainLimit,
      perSlotLimit: selector.perSlotLimit,
      perDomainSlotLimit: selector.perDomainSlotLimit,
      totalLimit: selector.totalLimit,
      header: "LONG_TERM_MEMORY",
      maxItems: 5,
      maxValueLength: 80,
      memoryService: memory,
    });

    longTermMemoryInjected = Boolean(
      longTermMemoryBridgeResult?.ok === true && longTermMemoryBridgeResult?.block
    );

    if (longTermMemoryInjected) {
      longTermMemorySystemMessage = {
        role: "system",
        content:
          "LONG-TERM MEMORY:\n" +
          "Primary stable memory. Prefer this over recall/history unless user corrects it now.\n\n" +
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

export default resolveLongTermMemoryBridge;