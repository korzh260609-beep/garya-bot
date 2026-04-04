// src/bot/handlers/chat/documentEstimateCorrectionResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT ESTIMATE CORRECTION RESOLVER
// Purpose:
// - detect whether the user is correcting the CURRENT estimate context
// - allow rebind from wrong/old estimate document to the most recent document
// - strictly for estimate correction only
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
    isEstimateCorrection: false,
    shouldRebindToRecentDocument: false,
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentEstimateCorrection({
  callAI,
  userText,
  currentEstimateFileName = "",
  recentDocumentFileName = "",
  hasActiveEstimate = false,
  hasRecentDocumentCandidate = false,
}) {
  const text = normalizeText(userText);
  if (!text) return fallbackResult("empty_text");
  if (typeof callAI !== "function") return fallbackResult("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for estimate-context correction in a Telegram assistant.\n" +
        "The assistant has ALREADY given a document chat split / token estimate.\n" +
        "Your task is ONLY to decide whether the user is correcting that estimate because it refers to the wrong file/document and wants the estimate rebound to the most recent document.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isEstimateCorrection": boolean,\n' +
        '  "shouldRebindToRecentDocument": boolean,\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- isEstimateCorrection=true only if the user is clearly saying the previous estimate used the wrong file/document.\n" +
        "- shouldRebindToRecentDocument=true only if the user clearly means the most recent uploaded/read file/document in current context.\n" +
        "- Do not confuse this with export/file generation requests.\n" +
        "- needsClarification=true only if the user is correcting the estimate but it is unclear which document should be used.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `User correction:\n${text}\n\n` +
        `Available context:\n` +
        `- activeEstimateAvailable: ${hasActiveEstimate ? "yes" : "no"}\n` +
        `- recentDocumentCandidateAvailable: ${hasRecentDocumentCandidate ? "yes" : "no"}\n` +
        `- currentEstimateFileName: ${normalizeText(currentEstimateFileName) || "unknown"}\n` +
        `- recentDocumentFileName: ${normalizeText(recentDocumentFileName) || "unknown"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 160,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackResult("json_parse_failed");
    }

    return {
      ok: true,
      isEstimateCorrection: Boolean(parsed?.isEstimateCorrection),
      shouldRebindToRecentDocument: Boolean(parsed?.shouldRebindToRecentDocument),
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
  resolveDocumentEstimateCorrection,
};