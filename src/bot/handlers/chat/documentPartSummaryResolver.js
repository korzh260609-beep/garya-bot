// src/bot/handlers/chat/documentPartSummaryResolver.js
// ============================================================================
// DOCUMENT PART SUMMARY RESOLVER
// Purpose:
// - detect request for SHORT SUMMARY / DESCRIPTION / ESSENCE of one specific part
// - semantic-only, not phrase-bound
// - must NOT confuse with:
//   1) raw part text request
//   2) estimate / parts count request
//   3) export request
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

function normalizeRequestedPartNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const normalized = Math.floor(n);
  return normalized > 0 ? normalized : 0;
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
    isDocumentPartSummaryRequest: false,
    requestedPartNumber: 0,
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentPartSummaryRequest({
  callAI,
  userText,
  estimateContext,
}) {
  const text = normalizeText(userText);
  if (!text) return fallbackResult("empty_text");
  if (typeof callAI !== "function") return fallbackResult("callai_missing");
  if (!estimateContext || typeof estimateContext !== "object") {
    return fallbackResult("estimate_context_missing");
  }

  const estimate = estimateContext?.estimate || {};
  const fileName = normalizeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0) || 0;

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for a Telegram assistant.\n" +
        "The assistant already has an active document context and document split.\n" +
        "Your task is ONLY to decide whether the user asks for a SHORT SUMMARY / DESCRIPTION / ESSENCE of ONE SPECIFIC PART of that document.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isDocumentPartSummaryRequest": boolean,\n' +
        '  "requestedPartNumber": number,\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- isDocumentPartSummaryRequest=true only if the user wants a short explanation/summary/description/about-what-it-says for a specific numbered part.\n" +
        "- requestedPartNumber must be the exact requested part number if clear; otherwise 0.\n" +
        "- Ordinals like first, second, sixteenth and Russian/Ukrainian colloquial ordinal forms must be converted to numbers.\n" +
        "- Do NOT confuse with request to SHOW the exact raw text of a part.\n" +
        "- Do NOT confuse with asking how many parts there are.\n" +
        "- Do NOT confuse with estimate continuation.\n" +
        "- Do NOT confuse with export/file generation requests.\n" +
        "- needsClarification=true only if the user clearly asks about a part summary but the part number is still unclear.\n" +
        '- clarificationQuestion must be one short neutral Russian question.\n' +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Known estimate context:\n` +
        `- fileName: ${fileName}\n` +
        `- chunkCount: ${chunkCount}\n\n` +
        `User message:\n${text}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 180,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackResult("json_parse_failed");
    }

    return {
      ok: true,
      isDocumentPartSummaryRequest: Boolean(parsed?.isDocumentPartSummaryRequest),
      requestedPartNumber: normalizeRequestedPartNumber(
        parsed?.requestedPartNumber
      ),
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
  resolveDocumentPartSummaryRequest,
};
