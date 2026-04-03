// src/bot/handlers/chat/documentFollowupIntentResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT FOLLOW-UP INTENT RESOLVER
// Purpose:
// - semantic resolution for document-related follow-up requests
// - decide whether user wants:
//   1) short summary
//   2) full text / parts
//   3) clarification
//   4) not a document intent
// - do NOT rely on exact phrases in app logic
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

function normalizeResponseMode(value) {
  const src = normalizeText(value).toLowerCase();

  if (src === "document_summary_answer") return "document_summary_answer";
  if (src === "document_full_text_answer") return "document_full_text_answer";
  if (src === "none") return "none";

  return "none";
}

function buildFallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    isDocumentIntent: false,
    responseMode: "none",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentFollowupIntent({
  callAI,
  userText,
  hasRecentDocument = false,
  hasAttachedDocument = false,
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
        "You are a strict semantic classifier for document follow-up requests in a Telegram assistant.\n" +
        "Your task: decide whether the user is asking about a document and whether they want:\n" +
        "1) short summary/general meaning\n" +
        "2) full text / full document / next part\n" +
        "3) clarification\n" +
        "4) not a document request\n\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isDocumentIntent": boolean,\n' +
        '  "responseMode": "document_summary_answer" | "document_full_text_answer" | "none",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- Use meaning and context, not exact phrases.\n" +
        "- If the user is asking for the essence/meaning/summary/what the document is about -> document_summary_answer.\n" +
        "- If the user wants the full content, full document text, all text, or continuation/next part -> document_full_text_answer.\n" +
        "- If there is no document intent -> isDocumentIntent=false and responseMode=none.\n" +
        "- needsClarification=true only if the user likely refers to a document but the intended action is ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- If request is not about a document, do not ask clarification.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `User text:\n${text}\n\n` +
        `Context availability:\n` +
        `- recentDocumentAvailable: ${hasRecentDocument ? "yes" : "no"}\n` +
        `- attachedDocumentInCurrentMessage: ${hasAttachedDocument ? "yes" : "no"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 180,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return buildFallbackResult("json_parse_failed");
    }

    return {
      ok: true,
      isDocumentIntent: Boolean(parsed?.isDocumentIntent),
      responseMode: normalizeResponseMode(parsed?.responseMode),
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
  resolveDocumentFollowupIntent,
};