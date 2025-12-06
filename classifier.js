// classifier.js
// Расширенный классификатор (фикс robot-слоя и документов)

export const TASK_TYPES = {
  CHAT: "chat",
  REPORT: "report",
  SIGNAL: "signal",
  NEWS: "news",
  DOCUMENT: "document",
  UNKNOWN: "unknown",
};

export const AI_COST_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/**
 * Классифицирует запрос пользователя.
 * Исправляет проблему, когда длинный текст (роадмап, документ)
 * ошибочно активировал robot-слой (sources, diagnostics).
 */
export function classifyInteraction({ userText } = {}) {
  const rawText = typeof userText === "string" ? userText : "";
  const text = rawText.toLowerCase().trim();

  let taskType = TASK_TYPES.CHAT;
  let aiCostLevel = AI_COST_LEVELS.LOW;
  let requiresAI = true;

  // ====================================================
  // 1) ОБРАБОТКА ДОКУМЕНТОВ / БОЛЬШИХ ТЕКСТОВ
  // ====================================================

  const lineCount = rawText.split("\n").length;

  const looksLikeDocument =
    rawText.length > 300 ||              // длинный текст
    lineCount > 5 ||                     // много строк
    rawText.includes("этап ") ||         // структура роадмапа
    rawText.includes("roadmap") ||       // англ варианты
    /^[\s\S]*?\d+\./m.test(rawText);     // многоуровневые списки

  if (looksLikeDocument) {
    return {
      taskType: TASK_TYPES.DOCUMENT,
      requiresAI: true,
      aiCostLevel: AI_COST_LEVELS.LOW,
    };
  }

  // ====================================================
  // 2) КОМАНДЫ УЧИТЫВАЮТСЯ ТОЛЬКО ЕСЛИ ВНАЧАЛЕ СООБЩЕНИЯ
  // ====================================================

  if (text.startsWith("/")) {
    return {
      taskType: TASK_TYPES.CHAT,
      requiresAI: false,
      aiCostLevel: AI_COST_LEVELS.LOW,
    };
  }

  // ====================================================
  // 3) ОСНОВНЫЕ ТИПЫ ЗАДАЧ
  // ====================================================

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
  if (
    text.includes("мониторинг") ||
    text.includes("новости") ||
    text.includes("news")
  ) {
    taskType = TASK_TYPES.NEWS;
    aiCostLevel = AI_COST_LEVELS.MEDIUM;
  }

  // ====================================================
  // 4) ЗАПРОСЫ НА БОЛЬШИЕ ОТЧЁТЫ = HIGH COST
  // ====================================================

  if (
    text.includes("полный отч") ||
    text.includes("большой текст") ||
    text.includes("статью") ||
    text.includes("статья") ||
    text.includes("long report") ||
    text.includes("big article")
  ) {
    taskType =
      taskType === TASK_TYPES.CHAT ? TASK_TYPES.REPORT : taskType;
    aiCostLevel = AI_COST_LEVELS.HIGH;
  }

  // Очень длинный текст → high cost
  if (text.length > 1500) {
    aiCostLevel = AI_COST_LEVELS.HIGH;
  }

  // ====================================================
  // 5) ВСЁ ОСТАЛЬНОЕ = AI чат
  // ====================================================

  return {
    taskType,
    requiresAI,
    aiCostLevel,
  };
}
