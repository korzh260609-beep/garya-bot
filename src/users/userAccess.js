// src/users/userAccess.js
// STAGE 4.5/4.6 — Access identity-first (provider -> user_identities -> global_user_id -> users)
//
// Rules:
// - chat_id = transport-level or synthetic identity-safe value only.
// - users.chat_id is NOT source of truth for role resolution.
// - source of truth for identity = user_identities -> global_user_id -> users.
//
// V1.4: bypassPermissions removed. Monarch is determined only by role "monarch" or explicit override.
// V1.5: provider-aware (default "telegram")
// V1.6: safer normalization + explicit legacy fallback

import pool from "../../db.js";

export async function resolveUserAccess({
  senderIdStr,
  isMonarch,
  provider = "telegram",
}) {
  const providerNorm = String(provider || "telegram").trim() || "telegram";
  const providerUserId = String(senderIdStr || "").trim();

  const monarchOverride =
    typeof isMonarch === "function" && isMonarch(providerUserId);

  if (!providerUserId) {
    const role = monarchOverride ? "monarch" : "guest";
    return {
      userRole: role,
      userPlan: "free",
      global_user_id: null,
      user: {
        role,
        plan: "free",
        global_user_id: null,
        hasIdentity: false,
      },
    };
  }

  let globalUserId = null;

  // 1) Identity mapping is source of truth
  const idRes = await pool.query(
    `
    SELECT global_user_id
    FROM user_identities
    WHERE provider = $1 AND provider_user_id = $2
    LIMIT 1
    `,
    [providerNorm, providerUserId]
  );

  globalUserId = idRes.rows?.[0]?.global_user_id || null;

  // 2) Legacy fallback — keeps old rows working if identity mapping is missing
  if (!globalUserId) {
    const legacyRes = await pool.query(
      `
      SELECT global_user_id
      FROM users
      WHERE tg_user_id = $1 OR global_user_id = $2
      LIMIT 1
      `,
      [providerUserId, `tg:${providerUserId}`]
    );

    globalUserId = legacyRes.rows?.[0]?.global_user_id || null;
  }

  if (!globalUserId) {
    const role = monarchOverride ? "monarch" : "guest";
    return {
      userRole: role,
      userPlan: "free",
      global_user_id: null,
      user: {
        role,
        plan: "free",
        global_user_id: null,
        hasIdentity: false,
      },
    };
  }

  const userRes = await pool.query(
    `
    SELECT global_user_id, role, language
    FROM users
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [globalUserId]
  );

  const dbUser = userRes.rows?.[0] || null;
  const dbRole = dbUser?.role || "guest";
  const finalRole = monarchOverride ? "monarch" : dbRole;

  const hasIdentityRes = await pool.query(
    `
    SELECT 1
    FROM user_identities
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [globalUserId]
  );

  const hasIdentity = Boolean(hasIdentityRes.rows?.length);

  return {
    userRole: finalRole,
    userPlan: "free",
    global_user_id: globalUserId,
    user: {
      role: finalRole,
      plan: "free",
      global_user_id: globalUserId,
      hasIdentity,
      language: dbUser?.language || null,
    },
  };
}