// classifier.js
// Скелет классификатора задач и стоимости ИИ

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
 * Скелет: по тексту запроса возвращает тип задачи и уровень "дороговизны" ИИ.
 * Пока логика минимальная, потом будем расширять.
 */
export function classifyInteraction({ userText }) {
  const text = (userText || "").toLowerCase();

  let taskType = TASK_TYPES.CHAT;
  let aiCostLevel = AI_COST_LEVELS.LOW;

  // Простейшие эвристики (их легко расширять)
  if (
    text.includes("отчёт") ||
    text.includes("отчет") ||
    text.includes("report")
  ) {
    taskType = TASK_TYPES.REPORT;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  if (text.includes("сигнал") || text.includes("signal") || text.includes("trade")) {
    taskType = TASK_TYPES.SIGNAL;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  if (text.includes("мониторинг") || text.includes("новости") || text.includes("news")) {
    taskType = TASK_TYPES.NEWS;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  // Очень длинные тексты — потенциально дорогие
  if (text.length > 1500) {
    aiCostLevel = AI_COST_LEVELS.HIGH;
  }

  return {
    taskType,
    requiresAI: true,
    aiCostLevel,
  };
}
