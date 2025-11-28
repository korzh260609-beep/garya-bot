// classifier.js
// Скелет классификатора задач и пример оценки "дороговизны" ИИ

export const TASK_TYPES = {
  CHAT: "chat",
  REPORT: "report",
  SIGNAL: "signal",
  NEWS: "news",
  UNKNOWN: "unknown",
};

export const AI_COST_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/**
 * Классифицирует запрос пользователя:
 *  - taskType   — тип задачи (chat / report / signal / news / unknown)
 *  - requiresAI — нужен ли вообще ИИ (для логов и будущих оптимизаций)
 *  - aiCostLevel — условная «стоимость» ответа (low / medium / high)
 *
 * Пока это лёгкий скелет с простыми эвристиками. Позже можно расширять
 * и/или вынести правила в БД/конфиг.
 */
export function classifyInteraction({ userText } = {}) {
  const rawText = typeof userText === "string" ? userText : "";
  const text = rawText.toLowerCase().trim();

  // По умолчанию — обычный чат, дешёвый ответ
  let taskType = TASK_TYPES.CHAT;
  let aiCostLevel = AI_COST_LEVELS.LOW;
  let requiresAI = true;

  // Если это команда вида "/something" — считаем служебным, без ИИ
  if (text.startsWith("/")) {
    return {
      taskType: TASK_TYPES.CHAT,
      requiresAI: false,
      aiCostLevel: AI_COST_LEVELS.LOW,
    };
  }

  // --- Простейшие эвристики по ключевым словам ---

  // Отчёты / аналитика
  if (
    text.includes("отчёт") ||
    text.includes("отчет") ||
    text.includes("report") ||
    text.includes("аналитик") ||
    text.includes("analysis")
  ) {
    taskType = TASK_TYPES.REPORT;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  // Сигналы / трейдинг
  if (
    text.includes("сигнал") ||
    text.includes("signal") ||
    text.includes("trade") ||
    text.includes("трейд")
  ) {
    taskType = TASK_TYPES.SIGNAL;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  // Новости / мониторинг
