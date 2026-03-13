// src/bot/handlers/grant.js
// Stage 11.12 — /grant
// Usage:
// - /grant <target_ref> <role>
//
// Canonical target_ref:
// - global_user_id
//
// Convenience fallback:
// - numeric telegram user id
// - tg:<telegram_user_id>
// - telegram:<telegram_user_id>
//
// Allowed roles:
// - guest
// - citizen
// - vip

import {
  setGrantedRole,
  normalizeGrantRole,
} from "../../users/grants.js";
import BehaviorEventsService from "../../logging/BehaviorEventsService.js";

const behaviorEvents = new BehaviorEventsService();

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
        "Где target_ref:",
        "- global_user_id (основной путь)",
        "- telegram user id (fallback)",
        "- tg:<telegram_user_id> (fallback)",
        "",
        "Где role:",
        "- guest",
        "- citizen",
        "- vip",
        "",
        "Пример:",
        "/grant usr_abc123 citizen",
        "/grant 123456789 vip",
        "/grant tg:123456789 guest",
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

    try {
      await behaviorEvents.logEvent({
        globalUserId: row.global_user_id,
        chatId: String(chatId),
        eventType: "role_granted",
        metadata: {
          target_ref: targetRef,
          previous_role: row.previous_role,
          next_role: row.role,
          changed_by: "monarch",
          tg_user_id: row.tg_user_id || null,
        },
        transport: "telegram",
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("handleGrant behavior_events error:", e);
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ ROLE UPDATED",
        `target: ${targetRef}`,
        `global_user_id: ${row.global_user_id}`,
        `tg_user_id: ${row.tg_user_id || "—"}`,
        `previous_role: ${row.previous_role}`,
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