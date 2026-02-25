// src/core/handleMessage.js
// STAGE 6.3 — handleMessage(context) (SKELETON)
// Purpose: single core entrypoint for any transport (Telegram/Discord/Web/Email).
// IMPORTANT: contract only. Shadow-wired into production flow.

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const globalUserId =
    context?.globalUserId == null ? null : String(context.globalUserId);
  const chatType = context?.chatType || null;
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean"
      ? context.isPrivateChat
      : null;

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

  // No routing, no memory, no access, no AI — Stage 6.3 only.
  return {
    ok: true,
    stage: "6.3",
    note: "handleMessage skeleton (shadow wired)",
    transport,
  };
}

export default handleMessage;
