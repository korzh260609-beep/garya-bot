export const MODEL_CONFIG = {
  robot: null,                   // робот-слой без модели

  nano: "gpt-5-nano",            // самая дешёвая GPT-модель для массовых простых задач
  low: "gpt-5-nano",             // дешёвые ответы, intent, summary, routing helpers
  medium: "gpt-5.4-nano",        // обычная работа СГ без тяжёлой архитектуры
  high: "gpt-5.4-mini",          // код, архитектура, аудит, сложная логика
  critical: "gpt-5.4",           // только для критических/сложных задач по явной необходимости

  default: "gpt-5-nano",         // routine default = максимально дешёвая модель
  legacyFallback: "gpt-4.1-mini", // безопасный fallback, если новая модель временно недоступна
};