// src/bot/handlers/chat/documentEstimateFollowUpResolver.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT ESTIMATE FOLLOW-UP RESOLVER
// Purpose:
// - detect whether the user follow-up refers to the LAST estimate result
// - semantic-only continuation, no exact phrase binding in app logic
// - decide what part of estimate the user asks about
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

function normalizeFocus(value) {
  const src = normalizeText(value).toLowerCase();

  if (src === "tokens") return "tokens";
  if (src === "chars") return "chars";
  if (src === "largest_part") return "largest_part";
  if (src === "file_vs_chat") return "file_vs_chat";
  if (src === "chunk_count") return "chunk_count";
  if (src === "parts_overview") return "parts_overview";
  if (src === "general_estimate") return "general_estimate";

  return "general_estimate";
}

function fallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    isFollowUpToLastEstimate: false,
    requestedFocus: "general_estimate",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveDocumentEstimateFollowUp({
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
  const charCount = Number(estimate?.charCount || 0) || 0;
  const chunkSize = Number(estimate?.chunkSize || 0) || 0;

  const largestPart = Array.isArray(estimate?.parts)
    ? estimate.parts.reduce(
        (max, part) => {
          const current = Number(part?.charCount || 0);
          return current > max.charCount
            ? {
                partNumber: Number(part?.partNumber || 0),
                charCount: current,
              }
            : max;
        },
        { partNumber: 0, charCount: 0 }
      )
    : { partNumber: 0, charCount: 0 };

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic classifier for follow-up questions in a Telegram assistant.\n" +
        "The assistant has ALREADY given a document chat/file split estimate.\n" +
        "Your task is ONLY to decide whether the user's NEW message refers to that LAST estimate result.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isFollowUpToLastEstimate": boolean,\n' +
        '  "requestedFocus": "tokens" | "chars" | "largest_part" | "file_vs_chat" | "chunk_count" | "parts_overview" | "general_estimate",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- isFollowUpToLastEstimate=true if the user is clearly asking about the estimate that was just given.\n" +
        "- requestedFocus=tokens when asking about approximate token count.\n" +
        "- requestedFocus=chars when asking about symbols/characters.\n" +
        "- requestedFocus=largest_part when asking which part is biggest/longest.\n" +
        "- requestedFocus=file_vs_chat when asking what is better: file or chat output.\n" +
        "- requestedFocus=chunk_count when asking how many parts/messages.\n" +
        "- requestedFocus=parts_overview when asking about parts in general.\n" +
        "- requestedFocus=general_estimate for general continuation about the same estimate.\n" +
        "- needsClarification=true only if the message is estimate-related but still too ambiguous.\n" +
        "- clarificationQuestion must be one short neutral Russian question.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Last estimate context:\n` +
        `- fileName: ${fileName}\n` +
        `- chunkCount: ${chunkCount}\n` +
        `- charCount: ${charCount}\n` +
        `- chunkSize: ${chunkSize}\n` +
        `- largestPartNumber: ${largestPart.partNumber}\n` +
        `- largestPartChars: ${largestPart.charCount}\n\n` +
        `User follow-up:\n${text}\n`,
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
      isFollowUpToLastEstimate: Boolean(parsed?.isFollowUpToLastEstimate),
      requestedFocus: normalizeFocus(parsed?.requestedFocus),
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
  resolveDocumentEstimateFollowUp,
};