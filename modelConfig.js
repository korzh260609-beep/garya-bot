export const MODEL_CONFIG = {
  robot: null,              // робот-слой без модели
  low: "gpt-4.1-mini",      // дешёвая / быстрая модель
  medium: "gpt-4.1-mini",   // пока безопасно держим medium на дешёвой модели
  high: "gpt-5.4",          // дорогая / сильная модель только для тяжёлых задач
  default: "gpt-4.1-mini",  // routine default = дешёвая модель
};