// ============================================================================
// === src/bot/handlers/behaviorEventsLast.js — show last behavior_events rows
// STAGE 5.16.2 — verification tool (DEV only, monarch-only via router + guard)
// ============================================================================

import pool from "../../../db.js";

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }
  return true;
}

export async function handleBehaviorEventsLast({ bot, chatId, rest, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);
  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const raw = String(rest || "").trim();
  const nRaw = raw ? Number(raw) : 5;
  const limit = Number.isFinite(nRaw) ? Math.max(1, Math.min(20, nRaw)) : 5;

  try {
    const res = await pool.query(
      `
      SELECT id, created_at, event_type, global_user_id, chat_id, metadata
      FROM behavior_events
      ORDER BY id DESC
      LIMIT $1
      `,
      [limit]
    );

    const rows = res.rows || [];
    if (rows.length === 0) {
      await bot.sendMessage(chatId, "behavior_events: empty");
      return;
    }

    const lines = [];
    lines.push(`behavior_events (last ${rows.length})`);

    for (const r of rows) {
      const ts = r.created_at ? new Date(r.created_at).toISOString() : "—";
      const metaStr = (() => {
        try {
          return JSON.stringify(r.metadata || {});
        } catch {
          return "{}";
        }
      })();

      lines.push(
        `#${r.id} | ${ts} | ${r.event_type} | g=${r.global_user_id || "NULL"} | chat=${r.chat_id || "NULL"} | meta=${metaStr}`
      );
    }

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
  } catch (e) {
    console.error("❌ handleBehaviorEventsLast failed:", e);
    await bot.sendMessage(chatId, "⚠️ /behavior_events_last failed. Check Render logs.");
  }
}
