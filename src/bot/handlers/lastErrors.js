// src/bot/handlers/lastErrors.js
// Stage 5.6 — /last_errors (READ-ONLY, safe output)

import pool from "../../../db.js";

function parseLimit(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return 5;

  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 5;

  if (n < 1) return 1;
  if (n > 20) return 20;
  return n;
}

function safeLine(s, max = 160) {
  const t = s === null || s === undefined ? "" : String(s);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

async function sendChunked(bot, chatId, text) {
  // Telegram hard limit ~4096 chars. Keep margin.
  const MAX = 3500;

  const full = String(text || "");
  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  // Split by lines to preserve readability.
  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? chunk + "\n" + line : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        // single line too long -> hard cut
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
      await sendChunked(bot, chatId, `LAST_ERRORS (n=${limit})\n(no records)`);
      return;
    }

    const lines = [];
    lines.push(`LAST_ERRORS (n=${rows.length})`);

    for (const e of rows) {
      const at = e?.created_at ? new Date(e.created_at).toISOString() : "unknown";
      const scope = safeLine(e?.scope || "unknown", 24);
      const scopeId =
        e?.scope_id === null || e?.scope_id === undefined ? "-" : String(e.scope_id);
      const sev = safeLine(e?.severity || "error", 10);
      const type = safeLine(e?.event_type || "unknown", 40);
      const msg = safeLine(e?.message || "unknown", 140);

      lines.push(`#${e.id} [${sev}] ${type} | ${scope}:${scopeId} | ${at}`);
      lines.push(`- ${msg}`);
    }

    await sendChunked(bot, chatId, lines.join("\n"));
  } catch (e) {
    // IMPORTANT: never let this handler go silent
    const msg = `LAST_ERRORS\n⛔ cannot read error_events (${safeLine(
      e?.message || "unknown error",
      180
    )})`;

    try {
      await sendChunked(bot, chatId, msg);
    } catch (_) {
      // final fallback: do nothing (avoid crash loop)
    }
  }
}
