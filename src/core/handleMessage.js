// src/core/handleMessage.js
// STAGE 6.3 — handleMessage(context) (SKELETON)
// Purpose: single core entrypoint for any transport (Telegram/Discord/Web/Email).
// IMPORTANT: contract only. Not wired into production flow yet.

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);

  // Skeleton observability (no DB, no side-effects beyond console)
  try {
    console.log("📨 handleMessage(SKELETON)", { transport, chatId, senderId });
  } catch {
    // ignore
  }

  // No routing, no memory, no access, no AI — Stage 6.3 only.
  return {
    ok: true,
    stage: "6.3",
    note: "handleMessage skeleton (not wired)",
    transport,
  };
}

export default handleMessage;
