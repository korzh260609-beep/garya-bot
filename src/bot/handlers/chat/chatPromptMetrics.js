// src/bot/handlers/chat/chatPromptMetrics.js

export function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function countWords(value) {
  const text = normalizeWhitespace(value);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

export function countSentenceMarks(value) {
  const text = String(value || "");
  const m = text.match(/[.!?]/g);
  return Array.isArray(m) ? m.length : 0;
}

export function countLineBreaks(value) {
  const text = String(value || "");
  const m = text.match(/\n/g);
  return Array.isArray(m) ? m.length : 0;
}

export function countChars(value) {
  if (value === null || value === undefined) return 0;
  return String(value).length;
}

export function sumMessageChars(list = []) {
  const items = Array.isArray(list) ? list : [];
  return items.reduce((sum, item) => sum + countChars(item?.content), 0);
}

export function sumMessageCharsByRole(list = [], role = "user") {
  const items = Array.isArray(list) ? list : [];
  return items.reduce((sum, item) => {
    if ((item?.role || "user") !== role) return sum;
    return sum + countChars(item?.content);
  }, 0);
}

export default {
  normalizeWhitespace,
  countWords,
  countSentenceMarks,
  countLineBreaks,
  countChars,
  sumMessageChars,
  sumMessageCharsByRole,
};
