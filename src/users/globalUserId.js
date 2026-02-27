// src/users/globalUserId.js
// STAGE 4.x — SG global user id generator/resolver
// Goal: new users get SG-issued id (usr_...), legacy tg:<id> remains untouched unless explicit migration.

import crypto from "crypto";
import pool from "../../db.js";

function genUserId() {
  // 16 hex = 64-bit entropy. Enough for our scale; still check for collisions.
  return `usr_${crypto.randomBytes(8).toString("hex")}`;
}

export async function resolveGlobalUserIdForTelegramUser(tgUserId) {
  const tg = String(tgUserId || "").trim();
  if (!tg) return null;

  // 1) identity mapping is source of truth
  const idRes = await pool.query(
    `
    SELECT global_user_id
    FROM user_identities
    WHERE provider = 'telegram' AND provider_user_id = $1
    LIMIT 1
    `,
    [tg]
  );

  const gid1 = idRes.rows?.[0]?.global_user_id || null;
  if (gid1) return gid1;

  // 2) legacy fallback (older rows may have been written without identity row)
  const legacyRes = await pool.query(
    `
    SELECT global_user_id
    FROM users
    WHERE tg_user_id = $1 OR global_user_id = $2
    LIMIT 1
    `,
    [tg, `tg:${tg}`]
  );

  return legacyRes.rows?.[0]?.global_user_id || null;
}

export async function generateUniqueGlobalUserId({ maxAttempts = 7 } = {}) {
  const attempts = Number.isFinite(maxAttempts) ? Math.max(1, maxAttempts) : 7;

  for (let i = 0; i < attempts; i++) {
    const candidate = genUserId();

    // collision check (cheap, low traffic)
    const exists = await pool.query(
      `
      SELECT 1
      FROM users
      WHERE global_user_id = $1
      LIMIT 1
      `,
      [candidate]
    );

    if (!exists.rows?.length) return candidate;
  }

  // Extremely unlikely; still fail safely
  throw new Error("GLOBAL_USER_ID_GENERATION_FAILED");
}
