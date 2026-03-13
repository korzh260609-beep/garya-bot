// src/bot/handlers/grant.js
// Stage 11.12 — /grant
// Usage:
// - /grant <target_ref> <role>
// target_ref:
// - global_user_id
// - telegram user id
//
// Allowed roles:
// - guest
// - citizen
// - vip

import {
  setGrantedRole,
  normalizeGrantRole,
} from "../../users/grants.js";

function parseArgs(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return { targetRef: null, role: null };

  const parts = raw.split(/\s+/);
  const targetRef = parts[0] ? String(parts[0]).trim() : null;
  const role = parts[1] ? String(parts[1]).trim() : null;

  return { targetRef, role };
}

export async function handleGrant({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const { targetRef, role } = parseArgs(rest);
  const normalizedRole = normalizeGrantRole(role);

  if (!targetRef || !normalizedRole) {
    await bot.sendMessage(
      chatId,
      [
        "Использование:",
        "/grant <target_ref> <role>",
        "",
        "Где role:",
        "- guest",
        "- citizen",
        "- vip",
        "",
        "Пример:",
        "/grant tg:123456 citizen",
        "/grant 123456 vip",
      ].join("\n")
    );
    return;
  }

  try {
    const row = await setGrantedRole({
      targetRef,
      nextRole: normalizedRole,
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
        "✅ ROLE UPDATED",
        `target: ${targetRef}`,
        `global_user_id: ${row.global_user_id}`,
        `tg_user_id: ${row.tg_user_id || "—"}`,
        `role: ${row.role}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("handleGrant error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${e?.message || "unknown"}`
    );
  }
}