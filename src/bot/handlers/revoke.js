// src/bot/handlers/revoke.js
// Stage 11.12 — /revoke
// Usage:
// - /revoke <target_ref>
//
// Canonical target_ref:
// - global_user_id
//
// Convenience fallback:
// - numeric telegram user id
// - tg:<telegram_user_id>
// - telegram:<telegram_user_id>
//
// Effect:
// - sets users.role -> guest

import { revokeGrantedRole } from "../../users/grants.js";
import AuditEventsService from "../../logging/AuditEventsService.js";

const auditEvents = new AuditEventsService();

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
        "Где target_ref:",
        "- global_user_id (основной путь)",
        "- telegram user id (fallback)",
        "- tg:<telegram_user_id> (fallback)",
        "",
        "Пример:",
        "/revoke usr_abc123",
        "/revoke 123456789",
        "/revoke tg:123456789",
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

    try {
      await auditEvents.logEvent({
        globalUserId: row.global_user_id,
        chatId: String(chatId),
        eventType: "role_revoked",
        actorRef: "monarch",
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
      console.error("handleRevoke audit_events error:", e);
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ ROLE REVOKED",
        `target: ${targetRef}`,
        `global_user_id: ${row.global_user_id}`,
        `tg_user_id: ${row.tg_user_id || "—"}`,
        `previous_role: ${row.previous_role}`,
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