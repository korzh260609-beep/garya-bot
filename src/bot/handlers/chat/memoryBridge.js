// src/bot/handlers/chat/memoryBridge.js

export function createChatMemoryBridge({
  chatIdStr,
  globalUserId,
  saveMessageToMemory,
  getMemoryService,
}) {
  const memory = getMemoryService ? getMemoryService() : null;

  const memoryWrite = async ({ role, content, transport, metadata, schemaVersion }) => {
    try {
      if (memory && typeof memory.write === "function") {
        return await memory.write({
          chatId: chatIdStr,
          globalUserId,
          role,
          content: typeof content === "string" ? content : String(content || ""),
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR MemoryService.write failed (fail-open):", e);
    }

    try {
      if (typeof saveMessageToMemory === "function") {
        return await saveMessageToMemory(chatIdStr, role, content, {
          globalUserId,
          transport: transport || "telegram",
          metadata: metadata || {},
          schemaVersion: schemaVersion || 2,
        });
      }
    } catch (e) {
      console.error("ERROR saveMessageToMemory fallback failed (fail-open):", e);
    }

    return { ok: true, stored: false, reason: "memory_write_fail_open" };
  };

  return {
    memory,
    memoryWrite,
  };
}