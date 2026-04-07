// src/bot/handlers/chat/chatPromptHeuristics.js

import {
  normalizeWhitespace,
  countWords,
  countSentenceMarks,
  countLineBreaks,
} from "./chatPromptMetrics.js";

export function hasStructuredPayload(value) {
  const text = String(value || "");
  if (!text) return false;

  if (text.includes("\n")) return true;
  if (text.includes(":")) return true;
  if (text.includes("{") || text.includes("}")) return true;
  if (text.includes("[") || text.includes("]")) return true;
  if (text.includes("/")) return true;
  if (text.includes("http://") || text.includes("https://")) return true;

  return false;
}

export function isStructurallyUnderspecifiedRequest(value) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const chars = text.length;
  const words = countWords(text);
  const sentenceMarks = countSentenceMarks(text);
  const lineBreaks = countLineBreaks(text);
  const structuredPayload = hasStructuredPayload(text);

  const shortByChars = chars <= 24;
  const shortByWords = words <= 3;
  const lowStructure = sentenceMarks <= 1 && lineBreaks === 0 && !structuredPayload;

  return shortByChars && shortByWords && lowStructure;
}

export function getLastAssistantMessage(history) {
  if (!Array.isArray(history) || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (item?.role === "assistant" && typeof item?.content === "string") {
      return item.content;
    }
  }

  return null;
}

export function hasReactionToneHints(text) {
  const s = String(text || "").trim();
  if (!s) return false;

  if (s.includes(")") || s.includes("))")) return true;
  if (s.includes("👍") || s.includes("👌") || s.includes("🙂") || s.includes("😊")) {
    return true;
  }
  if (s.endsWith("!")) return true;

  return false;
}

export function isLikelyAcknowledgmentToken(text) {
  const s = normalizeWhitespace(text).toLowerCase();
  if (!s) return false;

  const compact = s.replace(/[()!.,]+/g, "").trim();

  return new Set([
    "ок",
    "ok",
    "okay",
    "да",
    "ага",
    "угу",
    "ясно",
    "понял",
    "понятно",
    "принял",
    "хорошо",
    "норм",
    "нормально",
    "супер",
    "отлично",
  ]).has(compact);
}

export function isLikelyContextualReactionMessage(value, history) {
  const text = normalizeWhitespace(value);
  if (!text) return false;

  const chars = text.length;
  const words = countWords(text);
  const sentenceMarks = countSentenceMarks(text);
  const lineBreaks = countLineBreaks(text);
  const structuredPayload = hasStructuredPayload(text);
  const endsWithQuestion = text.endsWith("?");

  if (endsWithQuestion) return false;
  if (structuredPayload) return false;
  if (lineBreaks > 0) return false;
  if (sentenceMarks > 2) return false;
  if (chars > 80) return false;
  if (words > 8) return false;

  const lastAssistantMessage = getLastAssistantMessage(history);
  if (!lastAssistantMessage) return false;

  const lastAssistantChars = normalizeWhitespace(lastAssistantMessage).length;
  const lastAssistantWords = countWords(lastAssistantMessage);
  const lastAssistantWasSubstantive =
    lastAssistantChars >= 80 || lastAssistantWords >= 12;

  if (!lastAssistantWasSubstantive) {
    return false;
  }

  const reactionTone = hasReactionToneHints(text);
  const acknowledgmentToken = isLikelyAcknowledgmentToken(text);
  const shortEvaluativeUtterance =
    chars <= 40 && words <= 4 && !endsWithQuestion && !structuredPayload;

  return reactionTone || acknowledgmentToken || shortEvaluativeUtterance;
}

export default {
  hasStructuredPayload,
  isStructurallyUnderspecifiedRequest,
  getLastAssistantMessage,
  hasReactionToneHints,
  isLikelyAcknowledgmentToken,
  isLikelyContextualReactionMessage,
};
