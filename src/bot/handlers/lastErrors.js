// src/bot/handlers/lastErrors.js
// Stage 5.6 — /last_errors (READ-ONLY)

import pool from "../../../db.js";

function parseLimit(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return 5;

  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 5;

  // safety caps (read-only, but keep output small)
  if (n < 1) return 1;
  if (n > 20) return 20;
  return n;
}

function safeLine(s, max = 160) {
  const t = s === null || s === undefined ? "" : String(s);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export async function handleLastErrors({ bot, chatId, rest }) {
  const limit = parseLimit(rest);

  try {
    const r = await pool.query(
      `
      SELECT
        id,
        created_at,
        scope,
        scope_id,
        event_type,
        severity,
        message
      FROM error_events
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const rows = r?.rows || [];

    if (rows.length === 0) {
      await bot.sendMessage(chatId, `LAST_ERRORS (n=${limit})\n(no records)`);
      return;
    }

    const lines = [];
    lines.push(`LAST_ERRORS (n=${rows.length})`);

    for (const e of rows) {
      const at = e?.created_at ? new Date(e.created_at).toISOString() : "unknown";
      const scope = safeLine(e?.scope || "unknown", 24);
      const scopeId = e?.scope_id === null || e?.scope_id === undefined ? "-" : String(e.scope_id);
      const sev = safeLine(e?.severity || "error", 10);
      const type = safeLine(e?.event_type || "unknown", 40);
      const msg = safeLine(e?.message || "unknown", 140);

      lines.push(
        `#${e.id} [${sev}] ${type} | ${scope}:${scopeId} | ${at}\n- ${msg}`
      );
    }

    await bot.sendMessage(chatId, lines.join("\n"));
  } catch (e) {
    // table missing / permissions / any runtime issue — keep read-only safe output
    await bot.sendMessage(
      chatId,
      `LAST_ERRORS\n⛔ cannot read error_events (${safeLine(e?.message || "unknown error", 180)})`
    );
  }
}
