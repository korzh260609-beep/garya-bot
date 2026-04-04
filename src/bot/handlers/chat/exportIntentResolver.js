// src/bot/handlers/chat/exportIntentResolver.js
// ============================================================================
// STAGE 12A.2 — EXPORT INTENT RESOLVER
// Purpose:
// - semantic export intent resolution
// - DO NOT rely on hardcoded user phrases in app logic
// - use narrow AI classifier with recent context availability only
// - return safe structured result
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
  return "none";
}

function normalizeFormat(value) {
  const src = normalizeText(value).toLowerCase();

  if (src === "txt") return "txt";
  if (src === "md" || src === "markdown") return "md";
  if (src === "pdf") return "pdf";
  if (src === "docx") return "docx";
  if (src === "auto") return "auto";

  return "auto";
}

function buildFallbackResult(reason = "no_resolution") {
  return {
    ok: true,
    isExportIntent: false,
    sourceKind: "none",
    format: "auto",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: 0,
    reason,
  };
}

export async function resolveExportIntent({
  callAI,
  userText,
  hasRecentDocument = false,
  hasRecentAssistantReply = false,
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
        "You are a strict intent classifier for export requests in a Telegram assistant.\n" +
        "Your job is ONLY to decide whether the user is asking to create/send/export a file from recent chat content.\n" +
        "You must reason from meaning and context, not from exact phrases.\n" +
        "Return ONLY valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "isExportIntent": boolean,\n' +
        '  "sourceKind": "document" | "assistant_reply" | "auto" | "none",\n' +
        '  "format": "txt" | "md" | "pdf" | "docx" | "auto",\n' +
        '  "needsClarification": boolean,\n' +
        '  "clarificationQuestion": string,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- isExportIntent=true only if the user really wants a FILE to be created/sent/exported.\n" +
        "- sourceKind=document if the user clearly refers to uploaded/read document content.\n" +
        "- sourceKind=assistant_reply if the user clearly refers to the assistant's answer/reply/result.\n" +
        "- sourceKind=auto if export is intended but source is not explicit.\n" +
        "- sourceKind=none if not an export request.\n" +
        "- format=auto unless the user meaning clearly indicates txt/md/pdf/docx.\n" +
        "- needsClarification=true only when export intent is present but source or target is too ambiguous.\n" +
        "- clarificationQuestion must be one short neutral question in Russian.\n" +
        "- If the user asks to SHOW text IN CHAT, OUTPUT text HERE, CONTINUE in chat, count chat parts, or give document text directly in messages, that is NOT export.\n" +
        "- If the user asks for document summary/full text/current part in chat, that is NOT export.\n" +
        "- If the request is not about export, set isExportIntent=false and needsClarification=false.\n" +
        "- Do not explain. JSON only.",
    },
    {
      role: "user",
      content:
        `User text:\n${text}\n\n` +
        `Recent context availability:\n` +
        `- recentDocumentAvailable: ${hasRecentDocument ? "yes" : "no"}\n` +
        `- recentAssistantReplyAvailable: ${hasRecentAssistantReply ? "yes" : "no"}\n`,
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
      isExportIntent: Boolean(parsed?.isExportIntent),
      sourceKind: normalizeSourceKind(parsed?.sourceKind),
      format: normalizeFormat(parsed?.format),
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
  resolveExportIntent,
};