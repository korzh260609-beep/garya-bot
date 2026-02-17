// src/users/userAccess.js
// STAGE 4.5/4.6 — Access identity-first (provider -> user_identities -> global_user_id -> users)
// Правило: chat_id = transport only. Не используем users.chat_id для определения роли.
//
// V1.4: ❌ bypassPermissions полностью удалён. Монарх определяется только ролью "monarch".
// V1.5: ✅ provider-aware (по умолчанию "telegram", но можно передавать другой transport)

import pool from "../../db.js";

export async function resolveUserAccess({
  senderIdStr,
  isMonarch,
  provider = "telegram",
}) {
  const providerNorm = String(provider || "telegram").trim() || "telegram";
  const providerUserId = String(senderIdStr || "").trim();

  // Monarch override (ONLY by sender/user id)
  const monarchOverride =
    typeof isMonarch === "function" && isMonarch(providerUserId);

  // 1) Resolve global_user_id via identity mapping
  let globalUserId = null;

  if (providerUserId) {
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
  }

  // 2) Fallback (legacy) — try users by tg/global id (NOT by chat_id as source of truth)
  // This keeps system working if identity row wasn't created yet.
  if (!globalUserId && providerUserId) {
    const legacyRes = await pool.query(
      `
      SELECT global_user_id
      FROM users
      WHERE global_user_id = $1 OR tg_user_id = $2
      LIMIT 1
      `,
      [`tg:${providerUserId}`, providerUserId]
    );
    globalUserId = legacyRes.rows?.[0]?.global_user_id || null;
  }

  // If no resolved identity/user -> guest (or monarch if override)
  if (!globalUserId) {
    const role = monarchOverride ? "monarch" : "guest";
    return {
      userRole: role,
      userPlan: "free",
      user: {
        role,
        plan: "free",
        global_user_id: null,
        hasIdentity: false,
      },
    };
  }

  // 4) Load user by global_user_id (source of truth)
  const userRes = await pool.query(
    `
    SELECT global_user_id, role, language
    FROM users
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [globalUserId]
  );

  const dbRole = userRes.rows?.[0]?.role || "guest";
  const finalRole = monarchOverride ? "monarch" : dbRole;

  // 5) Has identity?
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
    user: {
      role: finalRole,
      plan: "free",
      global_user_id: globalUserId,
      hasIdentity,
    },
  };
}
