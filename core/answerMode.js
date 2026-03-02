// core/answerMode.js
// Режимы ответов (short/normal/long) и карта состояний по чатам.
//
// ✅ FIX (2026-03-02): adaptive answer_mode
// - explicit /mode overrides always win (stored in memory map)
// - default for MONARCH: normal
// - default for others: short (token economy)
// - auto-upgrade to normal/long when request clearly needs it (minimal-sufficient policy)

export const DEFAULT_ANSWER_MODE = "short"; // экономим токены по умолчанию

// В будущем это уйдёт в БД, сейчас — простая карта в памяти процесса
// chatId (строка) -> "short" | "normal" | "long"
const answerModeByChat = new Map();

function isExplicitMode(mode) {
  return mode === "short" || mode === "normal" || mode === "long";
}

function looksLikeNeedsMoreThanShort(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  // length heuristics
  if (t.length >= 220) return true;
  if (t.split("\n").length >= 5) return true;

  // complexity keywords (RU/UA/EN minimal)
  const low = t.toLowerCase();

  const hints = [
    "объясни",
    "поясни",
    "разбор",
    "детально",
    "детальний",
    "подробно",
    "пошагово",
    "по кроках",
    "інструкц",
    "план",
    "архитект",
    "архітект",
    "тз",
    "spec",
    "design",
    "why",
    "how",
    "compare",
    "example",
    "код",
    "code",
    "ошибка",
    "error",
    "лог",
    "logs",
    "диагност",
    "debug",
  ];

  for (const k of hints) {
    if (low.includes(k)) return true;
  }

  // if user clearly asks multiple questions
  const qCount = (t.match(/\?/g) || []).length;
  if (qCount >= 2) return true;

  // code-ish
  if (t.includes("```") || t.includes("{") || t.includes("}") || t.includes("=>")) return true;

  return false;
}

function looksLikeNeedsLong(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  if (t.length >= 700) return true;

  const low = t.toLowerCase();
  const strong = [
    "максимально подробно",
    "полный разбор",
    "повний розбір",
    "полная инструкция",
    "повна інструкція",
    "very detailed",
    "deep dive",
  ];

  for (const k of strong) {
    if (low.includes(k)) return true;
  }

  return false;
}

function clampMode(mode) {
  if (mode === "long") return "long";
  if (mode === "normal") return "normal";
  return "short";
}

/**
 * Получить режим ответа для чата.
 *
 * Backward-compatible signature:
 *   getAnswerMode(chatIdStr) -> mode
 *
 * New optional opts:
 *   getAnswerMode(chatIdStr, { isMonarch, text, taskType, aiCostLevel }) -> mode
 *
 * @param {string} chatIdStr - ID чата в виде строки.
 * @param {object} [opts]
 * @param {boolean} [opts.isMonarch]
 * @param {string} [opts.text]
 * @param {string} [opts.taskType]
 * @param {string} [opts.aiCostLevel]
 * @returns {"short"|"normal"|"long"}
 */
export function getAnswerMode(chatIdStr, opts = null) {
  const explicit = answerModeByChat.get(chatIdStr);
  if (isExplicitMode(explicit)) return explicit;

  const isMonarch = Boolean(opts && opts.isMonarch === true);
  const text = opts && typeof opts.text === "string" ? opts.text : "";
  const aiCostLevel = opts && typeof opts.aiCostLevel === "string" ? opts.aiCostLevel : "low";

  // 1) Base default by role
  let base = isMonarch ? "normal" : DEFAULT_ANSWER_MODE;

  // 2) Token economy: if task is marked "none" -> keep short always
  if (aiCostLevel === "none") return "short";

  // 3) Minimal-sufficient auto upgrade
  if (looksLikeNeedsMoreThanShort(text)) {
    base = "normal";
  }

  // 4) Allow long only when it’s clearly needed AND user is monarch
  if (isMonarch && looksLikeNeedsLong(text)) {
    base = "long";
  }

  return clampMode(base);
}

/**
 * Установить режим ответа для чата (explicit override).
 * @param {string} chatIdStr - ID чата в виде строки.
 * @param {"short"|"normal"|"long"} mode - новый режим.
 */
export function setAnswerMode(chatIdStr, mode) {
  answerModeByChat.set(chatIdStr, clampMode(mode));
}
