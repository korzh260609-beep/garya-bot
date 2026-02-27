// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) (SKELETON + derived chat meta)
// Purpose: single core entrypoint for any transport (Telegram/Discord/Web/Email).
// IMPORTANT: contract only. Shadow-wired into production flow.

import { deriveChatMeta } from "./transportMeta.js";

// ✅ STAGE 7.1 — Memory shadow hook (safe: runs only if messageId is provided)
import { getMemoryService } from "./memoryServiceFactory.js";

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const globalUserId =
    context?.globalUserId == null ? null : String(context.globalUserId);

  const text = context?.text == null ? "" : String(context.text);
  const messageId =
    context?.messageId == null ? null : String(context.messageId);

  const derived = deriveChatMeta({
    transport,
    chatId,
    senderId,
    transportChatType: context?.transportChatType ?? context?.chatType ?? null,
  });

  const chatType = derived.chatType || null;

  // Prefer explicit transport-provided boolean (backward compatible),
  // otherwise use core-derived value.
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean"
      ? context.isPrivateChat
      : derived.isPrivateChat;

  // Skeleton observability (no DB, no side-effects beyond console)
  try {
    console.log("📨 handleMessage(SKELETON)", {
      transport,
      chatId,
      senderId,
      globalUserId,
      chatType,
      isPrivateChat,
    });
  } catch {
    // ignore logging errors
  }

  // ✅ STAGE 7.1 — Memory shadow write (SAFE):
  // - runs only when messageId is present
  // - router now passes messageId (Stage 6 shadow wiring)
  // - never throws (doesn't block transport)
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);

    if (enabled && chatId && messageId && text) {
      await memory.write({
        chatId,
        globalUserId: globalUserId || null,
        role: "user",
        content: text,
        transport,
        metadata: {
          messageId,
          source: "core.handleMessage.shadow",
          chatType,
          isPrivateChat,
        },
        schemaVersion: 2,
      });
    }
  } catch (e) {
    console.error("handleMessage(memory shadow) failed:", e);
  }

  // No routing, no access, no AI — still skeleton-only.
  return {
    ok: true,
    stage: "6.4",
    note: "handleMessage skeleton (shadow wired) + derived chat meta + memory shadow hook (messageId-gated)",
    transport,
  };
}

export default handleMessage;
