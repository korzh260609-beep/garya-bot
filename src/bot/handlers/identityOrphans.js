// src/bot/handlers/identityOrphans.js
// Stage 4.5 — Identity orphan users (read-only)
// Shows users rows that have NO matching user_identities row.
//
// Command wiring will be added separately.
// Expected usage (future):
//   /identity_orphans          -> default limit=10
//   /identity_orphans 25       -> limit=25 (max 50)

import pool from "../../../db.js";

function clampInt(n, def, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  const v = Math.trunc(x);
  return Math.max(min, Math.min(max, v));
}

export async function handleIdentityOrphans({ bot, chatId, bypass, rest }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only.");
    return;
  }

  const limit = clampInt(String(rest || "").trim(), 10, 1, 50);

  try {
    const countRes = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM users u
      LEFT JOIN user_identities i
        ON i.global_user_id = u.global_user_id
      WHERE i.global_user_id IS NULL
    `);

    const total = countRes.rows?.[0]?.n ?? 0;

    const rowsRes = await pool.query(
      `
      SELECT
        u.id,
        u.global_user_id,
        u.tg_user_id,
        u.role,
        u.plan,
        u.created_at
      FROM users u
      LEFT JOIN user_identities i
        ON i.global_user_id = u.global_user_id
      WHERE i.global_user_id IS NULL
      ORDER BY u.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const lines = [];
    lines.push("🧩 IDENTITY ORPHANS (users without identity row)");
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
      const tg = r.tg_user_id == null ? "(null)" : String(r.tg_user_id);
      const role = r.role || "(null)";
      const plan = r.plan || "(null)";
      const created = r.created_at ? new Date(r.created_at).toISOString() : "(null)";

      lines.push(`- id=${id}`);
      lines.push(`  global_user_id=${gid}`);
      lines.push(`  tg_user_id=${tg}`);
      lines.push(`  role=${role} plan=${plan}`);
      lines.push(`  created_at=${created}`);
    }

    // quick hint (no actions)
    lines.push("");
    lines.push("ℹ️ Hint: if tg_user_id is null for these rows, /identity_backfill cannot create telegram identities.");

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
  } catch (e) {
    console.error("❌ /identity_orphans error:", e);
    await bot.sendMessage(chatId, "⚠️ /identity_orphans упал. Проверь users/user_identities.");
  }
}
