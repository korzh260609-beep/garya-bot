// src/core/projectIntent/conversation/projectIntentConversationAiGuard.js

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

const ACCESS_CONTRADICTION_PATTERNS = Object.freeze([
  "нет прямого доступа",
  "не имею прямого доступа",
  "у меня нет доступа",
  "я не вижу содержимое",
  "я не вижу файл",
  "не вижу содержимое файла",
  "не вижу код",
  "не могу видеть файл",
  "без доступа к файлу",
  "без прямого доступа",
  "i don't have direct access",
  "i do not have direct access",
  "i don't have access",
  "i cannot access the file",
  "i can't access the file",
  "i can't see the file",
  "i cannot see the file",
  "i can't see the contents",
  "i cannot see the contents",
]);

const MISSING_SOURCE_CONTRADICTION_PATTERNS = Object.freeze([
  "вы не приложили",
  "ты не приложил",
  "не приложили код",
  "не приложили файл",
  "не приложили список команд",
  "не предоставили код",
  "не предоставили файл",
  "не предоставили содержимое",
  "если предоставите",
  "если пришлете",
  "если пришлёте",
  "пришлите код",
  "пришлите файл",
  "покажите код",
  "нужен код файла",
  "нужен текст файла",
  "нужен список команд",
  "без кода не могу",
  "без содержимого файла",
  "you did not provide",
  "you didn't provide",
  "if you provide the file",
  "if you provide the code",
  "send the file",
  "send the code",
  "need the file contents",
  "need the source code",
]);

export function detectRepoExplainGroundingFailure({
  aiReply,
  content,
}) {
  const reply = safeText(aiReply);
  const source = safeText(content);

  if (!reply) {
    return {
      failed: true,
      reason: "empty_ai_reply",
      matchedPatterns: [],
    };
  }

  if (!source) {
    return {
      failed: false,
      reason: "",
      matchedPatterns: [],
    };
  }

  const normalized = normalizeText(reply);
  const matchedPatterns = [];

  for (const pattern of ACCESS_CONTRADICTION_PATTERNS) {
    if (normalized.includes(pattern)) {
      matchedPatterns.push(pattern);
    }
  }

  for (const pattern of MISSING_SOURCE_CONTRADICTION_PATTERNS) {
    if (normalized.includes(pattern)) {
      matchedPatterns.push(pattern);
    }
  }

  if (matchedPatterns.length > 0) {
    return {
      failed: true,
      reason: "source_access_contradiction",
      matchedPatterns: unique(matchedPatterns),
    };
  }

  return {
    failed: false,
    reason: "",
    matchedPatterns: [],
  };
}

export default {
  detectRepoExplainGroundingFailure,
};