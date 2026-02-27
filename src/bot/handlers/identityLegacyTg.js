// src/bot/handlers/identityLegacyTg.js
// Stage 4.5 — List legacy tg: global_user_id users (read-only)
// Shows users where global_user_id LIKE 'tg:%' with basic fields.
// Usage:
//   /identity_legacy_tg        -> limit=10
//   /identity_legacy_tg 25     -> limit=25 (max 50)

import pool from "../../../db.js";

function clampInt(n, def, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  const v = Math.trunc(x);
  return Math.max(min, Math.min(max, v));
}

export async function handleIdentityLegacyTg({ bot, chatId, bypass, rest }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only.");
    return;
  }

  const limit = clampInt(String(rest || "").trim(), 10, 1, 50);

  try {
    const countRes = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM users
      WHERE global_user_id LIKE 'tg:%'
    `);

    const total = countRes.rows?.[0]?.n ?? 0;

    const rowsRes = await pool.query(
      `
      SELECT
        id,
        global_user_id,
        chat_id,
        tg_user_id,
        name,
        role,
        language,
        created_at
      FROM users
      WHERE global_user_id LIKE 'tg:%'
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const lines = [];
    lines.push("🧬 IDENTITY LEGACY TG (users with global_user_id tg:*)");
    lines.push(`total: ${total}`);
    lines.push(`showing: ${Math.min(limit, rowsRes.rows?.length || 0)} (limit=${limit})`);
    lines.push("");

    if (!rowsRes.rows || rowsRes.rows.length === 0) {
      lines.push("✅ none");
      await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
      return;
    }

    for (const r of rowsRes.rows) {
      const id = r.id ?? "?";
      const gid = String(r.global_user_id || "");
      const chat = r.chat_id == null ? "(null)" : String(r.chat_id);
      const tg = r.tg_user_id == null ? "(null)" : String(r.tg_user_id);
      const name = r.name == null ? "(null)" : String(r.name);
      const role = r.role || "(null)";
      const lang = r.language == null ? "(null)" : String(r.language);
      const created = r.created_at ? new Date(r.created_at).toISOString() : "(null)";

      lines.push(`- id=${id}`);
      lines.push(`  global_user_id=${gid}`);
      lines.push(`  chat_id=${chat}`);
      lines.push(`  tg_user_id=${tg}`);
      lines.push(`  name=${name}`);
      lines.push(`  role=${role} language=${lang}`);
      lines.push(`  created_at=${created}`);
    }

    lines.push("");
    lines.push("ℹ️ Next: run /identity_upgrade_legacy (dry-run) and /identity_upgrade_legacy go in that user's PRIVATE chat (not in group).");

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
  } catch (e) {
    console.error("❌ /identity_legacy_tg error:", e);
    await bot.sendMessage(chatId, "⚠️ /identity_legacy_tg упал. Проверь users.");
  }
}
