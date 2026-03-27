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

function parseLimit(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return 5;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;

  if (n < 1) return 1;
  if (n > 20) return 20;
  return Math.trunc(n);
}

function safeLine(value, max = 500) {
  const s = value === null || value === undefined ? "" : String(value);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function safeJson(value, max = 900) {
  try {
    return safeLine(JSON.stringify(value || {}), max);
  } catch {
    return "{}";
  }
}

function formatKyivTs(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "unknown";

    const parts = new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(dt);

    return `${parts} (Kyiv)`;
  } catch (_) {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString() + " (UTC)";
    } catch {
      return "unknown";
    }
  }
}

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? chunk + "\n" + line : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

export async function handleBehaviorEventsLast({
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);
  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const limit = parseLimit(rest);

  try {
    const res = await pool.query(
      `
      SELECT
        id,
        created_at,
        event_type,
        global_user_id,
        chat_id,
        transport,
        schema_version,
        metadata
      FROM behavior_events
      ORDER BY id DESC
      LIMIT $1
      `,
      [limit]
    );

    const rows = res?.rows || [];

    if (rows.length === 0) {
      await sendChunked(bot, chatId, `behavior_events (n=${limit})\n(no records)`);
      return;
    }

    const lines = [];
    lines.push(`behavior_events (last ${rows.length})`);

    for (const r of rows) {
      const at = r?.created_at ? formatKyivTs(r.created_at) : "unknown";
      const eventType = safeLine(r?.event_type || "unknown", 80);
      const g = r?.global_user_id ? String(r.global_user_id) : "NULL";
      const chat = r?.chat_id ? String(r.chat_id) : "NULL";
      const transport = safeLine(r?.transport || "unknown", 20);
      const schemaVersion =
        r?.schema_version === null || r?.schema_version === undefined
          ? "NULL"
          : String(r.schema_version);

      lines.push(
        `#${r.id} | ${at} | ${eventType} | g=${g} | chat=${chat} | transport=${transport} | schema=${schemaVersion}`
      );
      lines.push(`meta=${safeJson(r?.metadata, 1200)}`);
    }

    await sendChunked(bot, chatId, lines.join("\n"));
  } catch (e) {
    console.error("❌ handleBehaviorEventsLast failed:", e);

    const msg = `behavior_events\n⚠️ cannot read behavior_events (${safeLine(
      e?.message || "unknown error",
      180
    )})`;

    try {
      await sendChunked(bot, chatId, msg);
    } catch (_) {
      // avoid crash loop
    }
  }
}