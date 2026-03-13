// ============================================================================
// === src/bot/router/chatMemoryWriters.js
// ============================================================================

export function createChatMemoryWriters({
  memory,
  msg,
  globalUserId,
  forcePairMessageId,
}) {
  const saveMessageToMemory = async (chatIdStr2, role, content, opts = {}) => {
    try {
      // ✅ STAGE 7 deterministic pairing: force pair key = msg.message_id
      const meta = forcePairMessageId(opts?.metadata ?? {}, msg);

      return await memory.write({
        chatId: String(chatIdStr2 || ""),
        globalUserId: opts?.globalUserId ?? globalUserId ?? null,
        role,
        content: String(content ?? ""),
        transport: opts?.transport ?? "telegram",
        metadata: meta,
        schemaVersion: opts?.schemaVersion ?? 2,
      });
    } catch (e) {
      console.error("router.saveMessageToMemory failed:", e);
    }
  };

  // ✅ STAGE 7 — deterministic save (assistant pairing)
  // IMPORTANT: force metadata.messageId to user telegram mid ALWAYS (not only when missing)
  const saveChatPair = async (chatIdStr2, _userText, assistantText, opts = {}) => {
    try {
      // ✅ STAGE 7 deterministic pairing: force pair key = msg.message_id
      const meta = forcePairMessageId(opts?.metadata ?? {}, msg);

      return await memory.write({
        chatId: String(chatIdStr2 || ""),
        globalUserId: opts?.globalUserId ?? globalUserId ?? null,
        role: "assistant",
        content: String(assistantText ?? ""),
        transport: opts?.transport ?? "telegram",
        metadata: meta,
        schemaVersion: opts?.schemaVersion ?? 2,
      });
    } catch (e) {
      console.error("router.saveChatPair failed:", e);
    }
  };

  return {
    saveMessageToMemory,
    saveChatPair,
  };
}