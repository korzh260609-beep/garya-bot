// src/bot/handlers/chat/alreadySeenFlow.js

import pool from "../../../../db.js";
import { getAlreadySeenDetector } from "../../../core/alreadySeenFactory.js";

export function normalizeAlreadySeenRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "monarch") return "monarch";
  if (role === "vip") return "vip";
  if (role === "citizen") return "citizen";
  return "guest";
}

export async function runAlreadySeenFlow({
  bot,
  chatId,
  chatIdStr,
  globalUserId,
  effective,
  userRole,
  saveAssistantHint,
}) {
  let softReaction = false;
  let lastMatchAt = null;

  try {
    const alreadySeen = getAlreadySeenDetector({ db: pool, logger: console });

    const alreadySeenTriggered = await alreadySeen.check({
      chatId: chatIdStr,
      globalUserId,
      text: effective,
      role: normalizeAlreadySeenRole(userRole),
    });

    lastMatchAt = typeof alreadySeen.getLastMatchAt === "function" ? alreadySeen.getLastMatchAt() : null;
    softReaction = Boolean(alreadySeenTriggered);
  } catch (e) {
    console.error("ERROR AlreadySeenDetector check failed (fail-open):", e);
  }

  if (softReaction === true) {
    try {
      const dt = lastMatchAt ? new Date(lastMatchAt) : null;
      const when = dt
        ? new Intl.DateTimeFormat("ru-RU", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(dt)
        : "неизвестно";

      const hintText = `💡 Похоже, це вже обговорювали. Останній збіг: ${when} (UTC)\nЯкщо є нове — уточни, что змінилося.`;

      await bot.sendMessage(chatId, hintText);

      try {
        await saveAssistantHint(hintText);
      } catch (e) {
        console.error("ERROR STAGE 7B already-seen hint insert failed (fail-open):", e);
      }
    } catch (e) {
      console.error("ERROR Telegram send error (soft hint):", e);
    }
  }

  return {
    softReaction,
    lastMatchAt,
  };
}