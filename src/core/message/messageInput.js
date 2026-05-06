// AGENT NOTE:
// SG 2.0 message input helpers.
// Purpose: isolate normalized message text extraction from core orchestration.
// Do not add identity, access, behavior, AI, or transport logic here.

export function extractMessageText(context = {}) {
  return String(context.text || "").trim();
}

export function buildEmptyTextReply(identity) {
  return {
    ok: true,
    reply: "Я получил сообщение, но в нём нет текста для ответа.",
    identity,
  };
}
