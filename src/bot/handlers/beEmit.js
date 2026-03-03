// src/bot/handlers/beEmit.js
// STAGE 5.16 — Behavior events test emitter (DEV ONLY)
//
// Usage (private chat only):
//   /be_emit permission_denied
//   /be_emit rate_limited
//   /be_emit custom_event_name {"any":"json"}
// Notes:
//   - Monarch only (bypass required).
//   - Writes to behavior_events for verification.

import { BehaviorEventsService } from "../../logging/BehaviorEventsService.js";

const svc = new BehaviorEventsService();

export async function handleBeEmit({
  bot,
  chatId,
  rest,
  senderIdStr,
  chatIdStr,
  transport = "telegram",
  globalUserId = null,
  bypass = false,
} = {}) {
  if (!bot || !chatId) return;

  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only (monarch).");
    return;
  }

  const raw = String(rest || "").trim();
  if (!raw) {
    await bot.sendMessage(
      chatId,
      [
        "Usage:",
        "/be_emit <eventType> [json_metadata]",
        "Examples:",
        "/be_emit permission_denied",
        '/be_emit rate_limited {"cmd":"/demo_task"}',
      ].join("\n")
    );
    return;
  }

  const firstSpace = raw.indexOf(" ");
  const eventType = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).trim();
  const jsonPart = (firstSpace === -1 ? "" : raw.slice(firstSpace + 1)).trim();

  let meta = {
    injected: true,
    senderId: senderIdStr || null,
  };

  if (jsonPart) {
    try {
      const obj = JSON.parse(jsonPart);
      if (obj && typeof obj === "object") meta = { ...meta, ...obj };
    } catch (e) {
      await bot.sendMessage(chatId, "⛔ Invalid JSON metadata.");
      return;
    }
  }

  try {
    await svc.logEvent({
      globalUserId: globalUserId || null,
      chatId: String(chatIdStr || chatId || ""),
      transport,
      eventType,
      metadata: meta,
      schemaVersion: 1,
    });

    await bot.sendMessage(chatId, `✅ behavior_event записан: ${eventType}`);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ Ошибка записи: ${e?.message || "unknown"}`);
  }
}
