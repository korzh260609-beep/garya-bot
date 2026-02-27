// src/bot/handlers/identityDiag.js
// Stage 4 — Identity diagnostics (read-only)

import pool from "../../../db.js";

export async function handleIdentityDiag({ bot, chatId, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only.");
    return;
  }

  try {
    const usersTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
    const usersTotal = usersTotalRes.rows?.[0]?.n ?? 0;

    const legacyTgRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE global_user_id LIKE 'tg:%'`
    );
    const usersLegacyTg = legacyTgRes.rows?.[0]?.n ?? 0;

    const usersUsrRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE global_user_id LIKE 'usr_%'`
    );
    const usersUsr = usersUsrRes.rows?.[0]?.n ?? 0;

    const usersOther = Math.max(0, usersTotal - usersLegacyTg - usersUsr);

    const usersNoIdentityRes = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM users u
      LEFT JOIN user_identities i
        ON i.global_user_id = u.global_user_id
      WHERE i.global_user_id IS NULL
    `);
    const usersNoIdentity = usersNoIdentityRes.rows?.[0]?.n ?? 0;

    const identitiesOrphanRes = await pool.query(`
      SELECT COUNT(*)::int AS n
      FROM user_identities i
      LEFT JOIN users u
        ON u.global_user_id = i.global_user_id
      WHERE u.global_user_id IS NULL
    `);
    const identitiesOrphan = identitiesOrphanRes.rows?.[0]?.n ?? 0;

    const providersRes = await pool.query(`
      SELECT provider, COUNT(*)::int AS n
      FROM user_identities
      GROUP BY provider
      ORDER BY n DESC
      LIMIT 10
    `);

    const providersLines = [];
    for (const r of providersRes.rows || []) {
      providersLines.push(`- ${r.provider}: ${r.n}`);
    }

    const lines = [];
    lines.push("🧬 IDENTITY DIAG");
    lines.push(`users_total: ${usersTotal}`);
    lines.push("");
    lines.push("global_user_id:");
    lines.push(`- usr_: ${usersUsr}`);
    lines.push(`- tg:: ${usersLegacyTg}`);
    lines.push(`- other: ${usersOther}`);
    lines.push("");
    lines.push(`users_without_identity_row: ${usersNoIdentity}`);
    lines.push(`identities_without_user_row: ${identitiesOrphan}`);
    lines.push("");
    lines.push("providers:");
    lines.push(providersLines.length ? providersLines.join("\n") : "- (none)");

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));
  } catch (e) {
    console.error("❌ /identity_diag error:", e);
    await bot.sendMessage(chatId, "⚠️ /identity_diag упал. Проверь users и user_identities.");
  }
}
