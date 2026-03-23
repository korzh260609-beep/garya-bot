// src/bot/handlers/chat/isStablePersonalFactQuestion.js

/**
 * Determines whether a message is asking about a stable personal fact
 * related to the user (self-referential persistent memory).
 *
 * Examples that should return true:
 * - "как меня зовут?"
 * - "какой у меня стиль общения?"
 * - "кто я?"
 * - "где я живу?"
 * - "когда у меня день рождения?"
 *
 * This does NOT rely on LTM presence.
 * It is purely structural pattern detection.
 */

function normalize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[!?.,]/g, "")
    .trim();
}

function isSelfQuestion(text) {
  const t = normalize(text);

  // Basic guard: must contain first-person reference
  const hasSelfReference =
    t.includes("я ") ||
    t.includes("я?") ||
    t.includes("меня") ||
    t.includes("мне") ||
    t.includes("мой") ||
    t.includes("моя") ||
    t.includes("моё") ||
    t.includes("мои") ||
    t.includes("у меня");

  if (!hasSelfReference) return false;

  // Question intent detection
  const questionStarters = [
    "кто",
    "какой",
    "какая",
    "какие",
    "какое",
    "как",
    "где",
    "когда",
    "почему",
    "сколько",
  ];

  const startsWithQuestionWord = questionStarters.some((w) =>
    t.startsWith(w + " ")
  );

  if (!startsWithQuestionWord) return false;

  // Explicit self-fact patterns (high confidence)
  const stableFactPatterns = [
    "как меня зовут",
    "кто я",
    "какой у меня",
    "какая у меня",
    "какое у меня",
    "какие у меня",
    "где я живу",
    "когда у меня",
    "какой мой",
    "какая моя",
    "какое моё",
    "какие мои",
  ];

  const matchesStablePattern = stableFactPatterns.some((p) =>
    t.startsWith(p)
  );

  return matchesStablePattern;
}

module.exports = {
  isStablePersonalFactQuestion: isSelfQuestion,
};