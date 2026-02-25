// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) (SKELETON + derived chat meta)
// Purpose: single core entrypoint for any transport (Telegram/Discord/Web/Email).
// IMPORTANT: contract only. Shadow-wired into production flow.

import { deriveChatMeta } from "./transportMeta.js";

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const globalUserId =
    context?.globalUserId == null ? null : String(context.globalUserId);

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

  // No routing, no memory, no access, no AI — Stage 6.4 still skeleton-only.
  return {
    ok: true,
    stage: "6.4",
    note: "handleMessage skeleton (shadow wired) + derived chat meta",
    transport,
  };
}

export default handleMessage;
