// core/answerMode.js
// Режимы ответов (short/normal/long) и карта состояний по чатам.

// === РЕЖИМЫ ОТВЕТОВ (answer_mode) ===
export const DEFAULT_ANSWER_MODE = "short"; // по ТЗ экономим токены по умолчанию

// В будущем это уйдёт в БД, сейчас — простая карта в памяти процесса
// chatId (строка) -> "short" | "normal" | "long"
const answerModeByChat = new Map();

/**
 * Получить режим ответа для чата.
 * @param {string} chatIdStr - ID чата в виде строки.
 * @returns {"short"|"normal"|"long"}
 */
export function getAnswerMode(chatIdStr) {
  return answerModeByChat.get(chatIdStr) || DEFAULT_ANSWER_MODE;
}

/**
 * Установить режим ответа для чата.
 * @param {string} chatIdStr - ID чата в виде строки.
 * @param {"short"|"normal"|"long"} mode - новый режим.
 */
export function setAnswerMode(chatIdStr, mode) {
  answerModeByChat.set(chatIdStr, mode);
}

