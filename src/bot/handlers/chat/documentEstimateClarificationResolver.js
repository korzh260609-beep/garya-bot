// src/bot/handlers/chat/documentEstimateClarificationResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT ESTIMATE CLARIFICATION RESOLVER
// Purpose:
// - resolve user's answer when SG уточняет, о каком документе идёт речь
// - strictly for estimate-mode continuation
// - no exact phrase dependency in app logic
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

function fallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    resolved: false,
    refersToRecentDocument: false,
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentEstimateClarification({
  callAI,
  userText,
  hasRecentDocument = false,
  hasRecentDocumentCandidate = false,
}) {
  const text = normalizeText(userText);
  if (!text) return fallbackResult("empty_text");
  if (typeof callAI !== "function") return fallbackResult("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for clarification answers in a Telegram assistant.\n" +
        "The assistant already asked which document the user means for chat split estimation.\n" +
        "Your task is ONLY to decide whether the user's answer refers to the recent document/file previously discussed.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "resolved": boolean,\n' +
        '  "refersToRecentDocument": boolean,\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- refersToRecentDocument=true if the user means the recent uploaded/read PDF/file/document from current context.\n" +
        "- Do not confuse this with export or file generation.\n" +
        "- resolved=true only if the answer is enough to continue estimate-mode.\n" +
        "- needsClarification=true only if still ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Clarification answer:\n${text}\n\n` +
        `Available context:\n` +
        `- recentRuntimeDocumentAvailable: ${hasRecentDocument ? "yes" : "no"}\n` +
        `- recentDocumentCandidateAvailable: ${hasRecentDocumentCandidate ? "yes" : "no"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 140,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackResult("json_parse_failed");
    }

    return {
      ok: true,
      resolved: Boolean(parsed?.resolved),
      refersToRecentDocument: Boolean(parsed?.refersToRecentDocument),
      needsClarification: Boolean(parsed?.needsClarification),
      clarificationQuestion: normalizeText(parsed?.clarificationQuestion),
      confidence: clampConfidence(parsed?.confidence),
      reason: normalizeText(parsed?.reason) || "resolved",
    };
  } catch (error) {
    return fallbackResult(
      error?.message ? `resolver_error:${String(error.message)}` : "resolver_error"
    );
  }
}

export default {
  resolveDocumentEstimateClarification,
};