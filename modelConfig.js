export const MODEL_CONFIG = {
  robot: null,                   // робот-слой без модели

  nano: "gpt-5-nano",            // самая дешёвая GPT-модель для массовых простых задач
  low: "gpt-4.1-mini",           // стабильный дешёвый режим после empty output на gpt-5-nano
  medium: "gpt-5.4-nano",        // обычная работа СГ без тяжёлой архитектуры
  high: "gpt-5.4-mini",          // код, архитектура, аудит, сложная логика
  critical: "gpt-5.4",           // только для критических/сложных задач по явной необходимости

  default: "gpt-4.1-mini",       // routine default = стабильный дешёвый режим
  legacyFallback: "gpt-4.1-mini", // безопасный fallback, если новая модель временно недоступна
};