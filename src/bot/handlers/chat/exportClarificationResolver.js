// src/bot/handlers/chat/exportClarificationResolver.js
// ============================================================================
// STAGE 12A.2 — EXPORT CLARIFICATION RESOLVER
// Purpose:
// - resolve user's answer to a pending export clarification
// - current clarification kinds:
//   1) export_source
//   2) document_export_target
// - semantic narrow classifier, JSON only
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

function normalizeSourceKind(value) {
  const src = normalizeText(value).toLowerCase();

  if (src === "document") return "document";
  if (src === "assistant_reply") return "assistant_reply";
  if (src === "auto") return "auto";

  return "auto";
}

function normalizeTarget(value) {
  const src = normalizeText(value).toLowerCase();

  if (src === "summary") return "summary";
  if (src === "full_text") return "full_text";
  if (src === "current_part") return "current_part";
  if (src === "assistant_answer_about_document") {
    return "assistant_answer_about_document";
  }
  if (src === "auto") return "auto";

  return "auto";
}

function fallbackSourceResult(reason = "no_resolution") {
  return {
    ok: true,
    resolved: false,
    sourceKind: "auto",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

function fallbackTargetResult(reason = "no_resolution") {
  return {
    ok: true,
    resolved: false,
    target: "auto",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveExportSourceClarification({
  callAI,
  userText,
  hasRecentDocument = false,
  hasRecentAssistantReply = false,
}) {
  const text = normalizeText(userText);
  if (!text) return fallbackSourceResult("empty_text");
  if (typeof callAI !== "function") return fallbackSourceResult("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for an answer to a clarification question in a Telegram assistant.\n" +
        "The assistant already asked which source should be exported.\n" +
        "Your task is ONLY to resolve the user's clarification answer.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "resolved": boolean,\n' +
        '  "sourceKind": "document" | "assistant_reply" | "auto",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- sourceKind=document if user means uploaded/read file/document/PDF content.\n" +
        "- sourceKind=assistant_reply if user means assistant's answer/explanation/result.\n" +
        "- resolved=true only when the answer is sufficient.\n" +
        "- needsClarification=true only if still ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Clarification answer:\n${text}\n\n` +
        `Available context:\n` +
        `- recentDocumentAvailable: ${hasRecentDocument ? "yes" : "no"}\n` +
        `- recentAssistantReplyAvailable: ${hasRecentAssistantReply ? "yes" : "no"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 160,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackSourceResult("json_parse_failed");
    }

    return {
      ok: true,
      resolved: Boolean(parsed?.resolved),
      sourceKind: normalizeSourceKind(parsed?.sourceKind),
      needsClarification: Boolean(parsed?.needsClarification),
      clarificationQuestion: normalizeText(parsed?.clarificationQuestion),
      confidence: clampConfidence(parsed?.confidence),
      reason: normalizeText(parsed?.reason) || "resolved",
    };
  } catch (error) {
    return fallbackSourceResult(
      error?.message ? `resolver_error:${String(error.message)}` : "resolver_error"
    );
  }
}

export async function resolveDocumentExportTargetClarification({
  callAI,
  userText,
  hasSummaryCandidate = false,
  hasFullTextCandidate = false,
  hasCurrentPartCandidate = false,
  hasAssistantAnswerCandidate = false,
}) {
  const text = normalizeText(userText);
  if (!text) return fallbackTargetResult("empty_text");
  if (typeof callAI !== "function") return fallbackTargetResult("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for an answer to a clarification question in a Telegram assistant.\n" +
        "The assistant already asked what exactly to export from document flow.\n" +
        "Your task is ONLY to resolve the user's clarification answer.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "resolved": boolean,\n' +
        '  "target": "summary" | "full_text" | "current_part" | "assistant_answer_about_document" | "auto",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- target=summary for short meaning/summary/essence.\n" +
        "- target=full_text for the whole document content.\n" +
        "- target=current_part for the currently shown chunk/part/fragment.\n" +
        "- target=assistant_answer_about_document for the assistant's explanation about the document.\n" +
        "- resolved=true only when the answer is sufficient.\n" +
        "- needsClarification=true only if still ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Clarification answer:\n${text}\n\n` +
        `Available context:\n` +
        `- summary: ${hasSummaryCandidate ? "yes" : "no"}\n` +
        `- full_text: ${hasFullTextCandidate ? "yes" : "no"}\n` +
        `- current_part: ${hasCurrentPartCandidate ? "yes" : "no"}\n` +
        `- assistant_answer_about_document: ${hasAssistantAnswerCandidate ? "yes" : "no"}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 160,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackTargetResult("json_parse_failed");
    }

    return {
      ok: true,
      resolved: Boolean(parsed?.resolved),
      target: normalizeTarget(parsed?.target),
      needsClarification: Boolean(parsed?.needsClarification),
      clarificationQuestion: normalizeText(parsed?.clarificationQuestion),
      confidence: clampConfidence(parsed?.confidence),
      reason: normalizeText(parsed?.reason) || "resolved",
    };
  } catch (error) {
    return fallbackTargetResult(
      error?.message ? `resolver_error:${String(error.message)}` : "resolver_error"
    );
  }
}

export default {
  resolveExportSourceClarification,
  resolveDocumentExportTargetClarification,
};