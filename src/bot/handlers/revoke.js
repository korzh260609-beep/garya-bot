// src/bot/handlers/revoke.js
// Stage 11.12 — /revoke
// Usage:
// - /revoke <target_ref>
// Effect:
// - sets users.role -> guest

import { revokeGrantedRole } from "../../users/grants.js";

function parseArgs(rest) {
  const raw = String(rest || "").trim();
  return raw ? raw : null;
}

export async function handleRevoke({
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
        "/revoke <target_ref>",
        "",
        "Пример:",
        "/revoke tg:123456",
        "/revoke 123456",
      ].join("\n")
    );
    return;
  }

  try {
    const row = await revokeGrantedRole({
      targetRef,
      changedBy: "monarch",
    });

    if (!row) {
      await bot.sendMessage(
        chatId,
        `⚠️ Пользователь не найден: ${targetRef}`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ ROLE REVOKED",
        `target: ${targetRef}`,
        `global_user_id: ${row.global_user_id}`,
        `tg_user_id: ${row.tg_user_id || "—"}`,
        `role: ${row.role}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("handleRevoke error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${e?.message || "unknown"}`
    );
  }
}