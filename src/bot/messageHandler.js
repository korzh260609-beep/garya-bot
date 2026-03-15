// src/bot/messageHandler.js
//
// ⚠️ NOT USED / LEGACY DRAFT
//
// Этот файл НЕ является активной точкой входа runtime.
// Актуальный runtime path:
//   index.js
//   -> attachMessageRouter(...)
//   -> TelegramAdapter.attach()
//
// Причина сохранения файла:
// - исторический черновик переноса bot.on("message", ...)
// - оставлен только как маркер старого направления
//
// ВАЖНО:
// - не импортировать в production wiring
// - не использовать как источник истины
// - не переносить сюда логику без отдельного утверждённого шага
//
// Если когда-либо понадобится реальный перенос:
// 1) сначала отдельный skeleton-step
// 2) затем wiring-step
// 3) затем runtime verification
//
// До этого момента файл считается НЕАКТИВНЫМ и служит только как явный legacy-marker.

export function initMessageHandler({ bot }) {
  bot.on("message", async (msg) => {
    // LEGACY DRAFT ONLY.
    // INTENTIONALLY EMPTY.
    // DO NOT USE IN RUNTIME.
  });
}