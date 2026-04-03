// src/bot/handlers/chat/documentExportTargetResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT EXPORT TARGET RESOLVER
// Purpose:
// - semantic resolution for WHAT exactly should be exported from document flow
// - choose one of:
//   1) summary
//   2) full_text
//   3) current_part
//   4) assistant_answer_about_document
//   5) auto
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

function buildFallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    target: "auto",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentExportTarget({
  callAI,
  userText,
  hasSummaryCandidate = false,
  hasFullTextCandidate = false,
  hasCurrentPartCandidate = false,
  hasAssistantAnswerCandidate = false,
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
        "You are a strict semantic classifier for export target selection in a Telegram assistant.\n" +
        "The system already knows the user wants a file/export related to recent document flow.\n" +
        "Your job is ONLY to decide WHAT content should be exported.\n\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "target": "summary" | "full_text" | "current_part" | "assistant_answer_about_document" | "auto",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- target=summary if the user wants the short meaning/summary/essence.\n" +
        "- target=full_text if the user wants the whole document content.\n" +
        "- target=current_part if the user refers to the currently shown part/this part/current fragment.\n" +
        "- target=assistant_answer_about_document if the user wants the assistant's answer/explanation about the document.\n" +
        "- target=auto if it is export-related but no precise target is clear.\n" +
        "- needsClarification=true only if the request is ambiguous between summary/full/current_part/assistant_answer.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `User text:\n${text}\n\n` +
        `Available candidates:\n` +
        `- summary: ${hasSummaryCandidate ? "yes" : "no"}\n` +
        `- full_text: ${hasFullTextCandidate ? "yes" : "no"}\n` +
        `- current_part: ${hasCurrentPartCandidate ? "yes" : "no"}\n` +
        `- assistant_answer_about_document: ${hasAssistantAnswerCandidate ? "yes" : "no"}\n`,
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
      target: normalizeTarget(parsed?.target),
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
  resolveDocumentExportTarget,
};