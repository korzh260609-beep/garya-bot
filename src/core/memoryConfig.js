// src/core/memoryConfig.js
// STAGE 7 — MEMORY LAYER V1 (CONFIG SKELETON)
// Никакой логики и никаких импортов projectMemory/db тут нет.
// Только конфиг и флаги.

export function getMemoryConfig() {
  return {
    // Глобальный флаг Memory Layer (пока выключено, чтобы не сломать прод)
    enabled: process.env.MEMORY_ENABLED === "1",

    // Режимы для дальнейшего расширения
    // SKELETON: ничего не пишем/читаем
    // PROJECT_MEMORY: читать/писать через projectMemory.js (позже через MemoryService-адаптер)
    mode: process.env.MEMORY_MODE || "SKELETON",

    // Ограничения (на будущее)
    maxItems: Number(process.env.MEMORY_MAX_ITEMS || 20),
    maxChars: Number(process.env.MEMORY_MAX_CHARS || 4000),

    // projectKey по умолчанию (на будущее, чтобы не хардкодить в нескольких местах)
    defaultProjectKey: process.env.MEMORY_PROJECT_KEY || "garya_ai",
  };
}

export default getMemoryConfig;
