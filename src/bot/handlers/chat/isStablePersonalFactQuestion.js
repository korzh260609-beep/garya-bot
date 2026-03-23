// src/bot/handlers/chat/isStablePersonalFactQuestion.js

function normalize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[!?.,]/g, "")
    .trim();
}

function isStablePersonalFactQuestion(text) {
  const t = normalize(text);

  const hasSelfReference =
    t.includes("я ") ||
    t.includes("меня") ||
    t.includes("мне") ||
    t.includes("мой") ||
    t.includes("моя") ||
    t.includes("моё") ||
    t.includes("мои") ||
    t.includes("у меня");

  if (!hasSelfReference) return false;

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

  return stableFactPatterns.some((p) => t.startsWith(p));
}

export default isStablePersonalFactQuestion;