// src/bot/handlers/grants.js
// Stage 11.12 — /grants
// Usage:
// - /grants <target_ref>
//
// Canonical target_ref:
// - global_user_id
//
// Convenience fallback:
// - numeric telegram user id
// - tg:<telegram_user_id>
// - telegram:<telegram_user_id>

import { getGrantInfo } from "../../users/grants.js";

function parseArgs(rest) {
  const raw = String(rest || "").trim();
  return raw ? raw : null;
}

export async function handleGrants({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const targetRef = parseArgs(rest);

  if (!targetRef) {
    await bot.sendMessage(
      chatId,
      [
        "Использование:",
        "/grants <target_ref>",
        "",
        "Где target_ref:",
        "- global_user_id (основной путь)",
        "- telegram user id (fallback)",
        "- tg:<telegram_user_id> (fallback)",
        "",
        "Пример:",
        "/grants usr_abc123",
        "/grants 123456789",
        "/grants tg:123456789",
      ].join("\n")
    );
    return;
  }

  try {
    const info = await getGrantInfo(targetRef);

    if (!info) {
      await bot.sendMessage(
        chatId,
        `⚠️ Пользователь не найден: ${targetRef}`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "🛡 USER ROLE",
        `target: ${targetRef}`,
        `global_user_id: ${info.global_user_id}`,
        `tg_user_id: ${info.tg_user_id || "—"}`,
        `role: ${info.role}`,
        `language: ${info.language || "—"}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("handleGrants error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${e?.message || "unknown"}`
    );
  }
}