// src/bot/handlers/identityBackfill.js
// Stage 4 — Identity backfill (safe, monarch-only, private-only)
// Usage:
//   /identity_backfill        -> dry-run
//   /identity_backfill go     -> execute

import pool from "../../../db.js";

function extractTgId({ globalUserId, tgUserId }) {
  if (tgUserId && String(tgUserId).trim()) return String(tgUserId).trim();

  const g = String(globalUserId || "").trim();
  if (g.startsWith("tg:")) {
    const tail = g.slice(3).trim();
    if (tail) return tail;
  }
  return null;
}

export async function handleIdentityBackfill({ bot, chatId, bypass, rest }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only.");
    return;
  }

  const mode = String(rest || "").trim().toLowerCase();
  const isGo = mode === "go";

  try {
    const rowsRes = await pool.query(`
      SELECT u.chat_id, u.global_user_id, u.tg_user_id
      FROM users u
      LEFT JOIN user_identities i
        ON i.global_user_id = u.global_user_id
      WHERE i.global_user_id IS NULL
      ORDER BY u.id ASC
      LIMIT 500
    `);

    const rows = rowsRes.rows || [];

    let candidates = 0;
    let wouldInsert = 0;
    let inserted = 0;
    let skipped = 0;
    let noTgId = 0;

    for (const r of rows) {
      candidates += 1;
      const tgId = extractTgId({ globalUserId: r.global_user_id, tgUserId: r.tg_user_id });

      if (!tgId) {
        noTgId += 1;
        continue;
      }

      wouldInsert += 1;

      if (!isGo) continue;

      // Insert mapping: telegram provider -> existing global_user_id (legacy for now)
      const ins = await pool.query(
        `
        INSERT INTO user_identities (global_user_id, provider, provider_user_id, chat_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (provider, provider_user_id)
        DO NOTHING
        `,
        [r.global_user_id, "telegram", tgId, r.chat_id]
      );

      // pg returns rowCount for INSERT
      if ((ins?.rowCount ?? 0) > 0) inserted += 1;
      else skipped += 1;
    }

    const lines = [];
    lines.push("🧩 IDENTITY BACKFILL");
    lines.push(`mode: ${isGo ? "EXECUTE" : "DRY_RUN"}`);
    lines.push(`candidates_missing_identity: ${candidates}`);
    lines.push(`with_tg_id: ${wouldInsert}`);
    lines.push(`no_tg_id: ${noTgId}`);
    if (isGo) {
      lines.push(`inserted: ${inserted}`);
      lines.push(`skipped_conflict: ${skipped}`);
    }
    lines.push("");
    lines.push("How to run:");
    lines.push("- /identity_backfill      (dry-run)");
    lines.push("- /identity_backfill go   (execute)");

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
  } catch (e) {
    console.error("❌ /identity_backfill error:", e);
    await bot.sendMessage(chatId, "⚠️ /identity_backfill упал. Проверь users и user_identities.");
  }
}
