// src/bot/handlers/chat/documentChatEstimateResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT CHAT ESTIMATE RESOLVER
// Purpose:
// - semantic detection of "estimate how many parts/messages the document will be"
// - this is NOT export
// - this is NOT full-text action
// - use meaning + recent document context
// ============================================================================

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeText(value).trim();
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseJsonObjectFromText(value) {
  const text = safeText(value).trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  const candidate = text.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildFallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    isEstimateIntent: false,
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentChatEstimateIntent({
  callAI,
  userText,
  hasRecentDocument = false,
}) {
  const text = normalizeText(userText);
  if (!text) {
    return buildFallbackResult("empty_text");
  }

  if (typeof callAI !== "function") {
    return buildFallbackResult("callai_missing");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for document-related chat questions in a Telegram assistant.\n" +
        "Your task is ONLY to decide whether the user is asking for an estimate of how many chat parts/messages the document would be split into.\n" +
        "This is NOT export.\n" +
        "This is NOT an instruction to output the document now.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isEstimateIntent": boolean,\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- isEstimateIntent=true only if the user asks about quantity/number of parts/messages/chunks when showing the document in chat.\n" +
        "- If the user is asking to actually show/export/save/send, then isEstimateIntent=false.\n" +
        "- needsClarification=true only if it is likely about estimating parts but too ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `User text:\n${text}\n\n` +
        `Context availability:\n` +
        `- recentDocumentAvailable: ${hasRecentDocument ? "yes" : "no"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 120,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return buildFallbackResult("json_parse_failed");
    }

    return {
      ok: true,
      isEstimateIntent: Boolean(parsed?.isEstimateIntent),
      needsClarification: Boolean(parsed?.needsClarification),
      clarificationQuestion: normalizeText(parsed?.clarificationQuestion),
      confidence: clampConfidence(parsed?.confidence),
      reason: normalizeText(parsed?.reason) || "resolved",
    };
  } catch (error) {
    return buildFallbackResult(
      error?.message ? `resolver_error:${String(error.message)}` : "resolver_error"
    );
  }
}

export default {
  resolveDocumentChatEstimateIntent,
};