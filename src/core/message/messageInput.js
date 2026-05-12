// AGENT NOTE:
// SG 2.0 message input helpers.
// Purpose: isolate normalized message text extraction and safe message runtime options from core orchestration.
// Do not add identity, access, behavior, AI, or transport logic here.
// Do not infer project context from natural-language text here.

export function extractMessageText(context = {}) {
  return String(context.text || "").trim();
}

function normalizeExplicitProjectContextOption(context = {}) {
  const explicitProjectContext = context?.runtimeOptions?.explicitProjectContext;

  if (!explicitProjectContext || typeof explicitProjectContext !== "object") {
    return null;
  }

  return explicitProjectContext;
}

export function buildMessageRuntimeOptions(context = {}) {
  return {
    explicitProjectContext: normalizeExplicitProjectContextOption(context),
  };
}

export function buildEmptyTextReply(identity) {
  return {
    ok: true,
    reply: "Я получил сообщение, но в нём нет текста для ответа.",
    identity,
  };
}
