// src/core/memoryConfig.js
// STAGE 7 — MEMORY LAYER V1 (CONFIG)
// Только конфиг и флаги. Без бизнес-логики и без прямых DB импортов.

function envTruthy(v) {
  if (v === true) return true;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function getMemoryConfig() {
  const enabled = envTruthy(process.env.MEMORY_ENABLED);

  return {
    // Глобальный флаг Memory Layer
    enabled,

    // Режимы:
    // CHAT_MEMORY_V1: текущий рабочий backend Stage 7 (chat_memory)
    // (дальше будут другие режимы, но сейчас держим честный дефолт)
    mode: process.env.MEMORY_MODE || "CHAT_MEMORY_V1",

    // Лимиты чтения контекста (для формирования промпта)
    maxItems: Number(process.env.MEMORY_MAX_ITEMS || 20),
    maxChars: Number(process.env.MEMORY_MAX_CHARS || 4000),

    // Резерв на будущее (не используется в Stage 7, но оставляем как конфиг-ключ)
    defaultProjectKey: process.env.MEMORY_PROJECT_KEY || "garya_ai",
  };
}

export default getMemoryConfig;
