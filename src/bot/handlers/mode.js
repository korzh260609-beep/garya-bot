// src/bot/handlers/mode.js
// extracted from case "/mode" — no logic changes
// ✅ STAGE 5.16 — behavior_events: answer_mode_changed

import BehaviorEventsService from "../../logging/BehaviorEventsService.js";

export async function handleMode({
  bot,
  chatId,
  chatIdStr,
  rest,
  setAnswerMode,
  globalUserId = null,
}) {
  const modeRaw = (rest || "").trim();
  if (!modeRaw) {
    await bot.sendMessage(chatId, "Использование: /mode short | normal | long");
    return;
  }

  const mode = modeRaw.toLowerCase();
  const valid = ["short", "normal", "long"];

  if (!valid.includes(mode)) {
    await bot.sendMessage(chatId, "Режимы: short / normal / long");
    return;
  }

  setAnswerMode(chatIdStr, mode);
  await bot.sendMessage(chatId, `Режим ответа: ${mode}`);

  // ✅ STAGE 5.16 — log answer_mode_changed
  try {
    const behaviorEvents = new BehaviorEventsService();
    await behaviorEvents.logEvent({
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      eventType: "answer_mode_changed",
      metadata: {
        mode,
      },
      transport: "telegram",
      schemaVersion: 1,
    });
  } catch (e) {
    console.error("behavior_events answer_mode_changed log failed:", e);
  }
}
