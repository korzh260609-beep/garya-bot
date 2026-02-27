// src/bot/handlers/identityUpgradeLegacy.js
// Stage 4.5 — Legacy global_user_id upgrade (tg:<id> -> usr_<...>)
// Monarch-only (bypass), safe, private-only
//
// Usage:
//   /identity_upgrade_legacy        -> dry-run (current sender)
//   /identity_upgrade_legacy go     -> execute (current sender)
//
// Notes:
// - DOES NOT require linking to be V2; this migrates existing DB rows.
// - Keeps backward compatibility via users.tg_user_id fallback in resolver.
// - Updates dependent tables that store global_user_id (user_links, identity_link_codes).
// - No wiring here: you must explicitly connect this handler to a command later.

import pool from "../../../db.js";
import {
  resolveGlobalUserIdForTelegramUser,
  generateUniqueGlobalUserId,
} from "../../users/globalUserId.js";

function isLegacyTgGlobalId(gid) {
  const s = String(gid || "").trim();
  return s.startsWith("tg:");
}

function short(s, n = 120) {
  const x = String(s || "");
  if (x.length <= n) return x;
  return x.slice(0, n) + "...";
}

export async function handleIdentityUpgradeLegacy({ bot, chatId, senderIdStr, bypass, rest }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ DEV only.");
    return;
  }

  const mode = String(rest || "").trim().toLowerCase();
  const isGo = mode === "go";

  const tgId = String(senderIdStr || "").trim();
  if (!tgId) {
    await bot.sendMessage(chatId, "⚠️ No senderIdStr (tg user id).");
    return;
  }

  // Resolve current global id (identity-first, then legacy fallback)
  let currentGlobal = null;
  try {
    currentGlobal = await resolveGlobalUserIdForTelegramUser(tgId);
  } catch (e) {
    await bot.sendMessage(chatId, `⚠️ resolveGlobalUserIdForTelegramUser failed: ${short(e?.message || e)}`);
    return;
  }

  if (!currentGlobal) {
    await bot.sendMessage(chatId, "⚠️ No global_user_id resolved for this telegram user.");
    return;
  }

  // Already upgraded
  if (!isLegacyTgGlobalId(currentGlobal)) {
    await bot.sendMessage(
      chatId,
      [
        "✅ identity_upgrade_legacy: nothing to do",
        `mode: ${isGo ? "EXECUTE" : "DRY_RUN"}`,
        `telegram_user_id: ${tgId}`,
        `current_global_user_id: ${currentGlobal}`,
        "",
        "This user is already on non-legacy global_user_id.",
      ].join("\n")
    );
    return;
  }

  // Plan new id (only if execute; for dry-run we still show a sample)
  let newGlobal = null;
  try {
    newGlobal = await generateUniqueGlobalUserId();
  } catch (e) {
    await bot.sendMessage(chatId, `⚠️ generateUniqueGlobalUserId failed: ${short(e?.message || e)}`);
    return;
  }

  // Dry-run: compute impact counts (best-effort)
  let counts = {
    users: 0,
    user_identities: 0,
    user_links_global: 0,
    user_links_linked_by: 0,
    identity_link_codes: 0,
  };

  try {
    const c1 = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users WHERE global_user_id = $1`,
      [currentGlobal]
    );
    counts.users = c1.rows?.[0]?.c ?? 0;

    const c2 = await pool.query(
      `SELECT COUNT(*)::int AS c FROM user_identities WHERE provider = 'telegram' AND provider_user_id = $1`,
      [tgId]
    );
    counts.user_identities = c2.rows?.[0]?.c ?? 0;

    const c3 = await pool.query(
      `SELECT COUNT(*)::int AS c FROM user_links WHERE global_user_id = $1`,
      [currentGlobal]
    );
    counts.user_links_global = c3.rows?.[0]?.c ?? 0;

    const c4 = await pool.query(
      `SELECT COUNT(*)::int AS c FROM user_links WHERE linked_by_global_user_id = $1`,
      [currentGlobal]
    );
    counts.user_links_linked_by = c4.rows?.[0]?.c ?? 0;

    const c5 = await pool.query(
      `SELECT COUNT(*)::int AS c FROM identity_link_codes WHERE global_user_id = $1`,
      [currentGlobal]
    );
    counts.identity_link_codes = c5.rows?.[0]?.c ?? 0;
  } catch (e) {
    // do not block; counts are just informative
  }

  if (!isGo) {
    await bot.sendMessage(
      chatId,
      [
        "🧪 IDENTITY UPGRADE LEGACY (DRY_RUN)",
        `telegram_user_id: ${tgId}`,
        `from_global_user_id: ${currentGlobal}`,
        `to_global_user_id: ${newGlobal}`,
        "",
        "Would update rows:",
        `- users: ${counts.users}`,
        `- user_identities (telegram mapping rows): ${counts.user_identities}`,
        `- user_links.global_user_id: ${counts.user_links_global}`,
        `- user_links.linked_by_global_user_id: ${counts.user_links_linked_by}`,
        `- identity_link_codes.global_user_id: ${counts.identity_link_codes}`,
        "",
        "Run:",
        "/identity_upgrade_legacy go",
      ].join("\n").slice(0, 3800)
    );
    return;
  }

  // EXECUTE (transaction)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) users: rewrite global_user_id (preserve tg_user_id column)
    const u1 = await client.query(
      `UPDATE users SET global_user_id = $1 WHERE global_user_id = $2`,
      [newGlobal, currentGlobal]
    );

    // 2) user_identities: ensure telegram mapping points to newGlobal
    // NOTE: there must be only one row per (provider, provider_user_id)
    const u2 = await client.query(
      `
      UPDATE user_identities
      SET global_user_id = $1
      WHERE provider = 'telegram' AND provider_user_id = $2
      `,
      [newGlobal, tgId]
    );

    // 3) user_links: rewrite both global_user_id and linked_by_global_user_id
    const u3 = await client.query(
      `UPDATE user_links SET global_user_id = $1 WHERE global_user_id = $2`,
      [newGlobal, currentGlobal]
    );

    const u4 = await client.query(
      `UPDATE user_links SET linked_by_global_user_id = $1 WHERE linked_by_global_user_id = $2`,
      [newGlobal, currentGlobal]
    );

    // 4) identity_link_codes: rewrite global_user_id so pending/consumed codes remain consistent
    const u5 = await client.query(
      `UPDATE identity_link_codes SET global_user_id = $1 WHERE global_user_id = $2`,
      [newGlobal, currentGlobal]
    );

    await client.query("COMMIT");

    await bot.sendMessage(
      chatId,
      [
        "✅ IDENTITY UPGRADE LEGACY (EXECUTE)",
        `telegram_user_id: ${tgId}`,
        `from_global_user_id: ${currentGlobal}`,
        `to_global_user_id: ${newGlobal}`,
        "",
        "Updated rows:",
        `- users: ${u1?.rowCount ?? 0}`,
        `- user_identities (telegram): ${u2?.rowCount ?? 0}`,
        `- user_links.global_user_id: ${u3?.rowCount ?? 0}`,
        `- user_links.linked_by_global_user_id: ${u4?.rowCount ?? 0}`,
        `- identity_link_codes: ${u5?.rowCount ?? 0}`,
      ].join("\n").slice(0, 3800)
    );
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    await bot.sendMessage(
      chatId,
      [
        "⚠️ IDENTITY UPGRADE LEGACY FAILED",
        `telegram_user_id: ${tgId}`,
        `from_global_user_id: ${currentGlobal}`,
        `to_global_user_id: ${newGlobal}`,
        "",
        `error: ${short(e?.message || e)}`,
      ].join("\n").slice(0, 3800)
    );
  } finally {
    client.release();
  }
}
