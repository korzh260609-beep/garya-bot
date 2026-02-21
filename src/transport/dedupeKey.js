// src/transport/dedupeKey.js
// STAGE 6.8.1 — adapter→core dedupe key (SKELETON)
//
// Purpose:
//   Provide a stable key for transport-level idempotency / dedupe.
//   Used later to protect against webhook retries & double-processing.
//
// IMPORTANT:
//   Contract only. Not wired into production yet.
//   No DB calls. No side-effects.

export function buildTransportDedupeKey(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? "null" : String(context.chatId);
  const senderId = context?.senderId == null ? "null" : String(context.senderId);

  // Stage 6.8.1 skeleton: minimal stable key
  // Later (Stage 7B/Idempotency): include platform_message_id / update_id / thread_id from context.meta
  return `${transport}:${chatId}:${senderId}`;
}

export default buildTransportDedupeKey;
