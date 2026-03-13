// src/users/grants.js
// Stage 11.12 — Grants V1
// PURPOSE:
// - monarch-only role management without direct SQL
// - V1 scope: users.role only
// - supported roles: guest / citizen / vip
// - monarch role is NOT grantable via bot command

import pool from "../../db.js";

export const GRANTABLE_ROLES = new Set(["guest", "citizen", "vip"]);

export function normalizeGrantRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!GRANTABLE_ROLES.has(value)) return null;
  return value;
}

async function findUserByGlobalUserId(globalUserId) {
  const res = await pool.query(
    `
    SELECT global_user_id, tg_user_id, role, language
    FROM users
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [String(globalUserId)]
  );

  return res.rows?.[0] || null;
}

async function findUserByTelegramUserId(tgUserId) {
  const raw = String(tgUserId || "").trim();
  if (!raw) return null;

  const res = await pool.query(
    `
    SELECT global_user_id, tg_user_id, role, language
    FROM users
    WHERE tg_user_id = $1
    LIMIT 1
    `,
    [raw]
  );

  return res.rows?.[0] || null;
}

async function findUserByIdentityProviderUserId(providerUserId) {
  const raw = String(providerUserId || "").trim();
  if (!raw) return null;

  const res = await pool.query(
    `
    SELECT u.global_user_id, u.tg_user_id, u.role, u.language
    FROM user_identities ui
    JOIN users u
      ON u.global_user_id = ui.global_user_id
    WHERE ui.provider = 'telegram'
      AND ui.provider_user_id = $1
    LIMIT 1
    `,
    [raw]
  );

  return res.rows?.[0] || null;
}

export async function resolveGrantTarget(targetRef) {
  const raw = String(targetRef || "").trim();
  if (!raw) return null;

  // 1) Exact global_user_id
  let user = await findUserByGlobalUserId(raw);
  if (user) return user;

  // 2) Telegram numeric ID in users.tg_user_id
  if (/^\d+$/.test(raw)) {
    user = await findUserByTelegramUserId(raw);
    if (user) return user;

    // 3) Telegram provider_user_id via user_identities
    user = await findUserByIdentityProviderUserId(raw);
    if (user) return user;
  }

  return null;
}

export async function getGrantInfo(targetRef) {
  const user = await resolveGrantTarget(targetRef);
  if (!user) return null;

  return {
    global_user_id: user.global_user_id,
    tg_user_id: user.tg_user_id || null,
    role: String(user.role || "guest"),
    language: user.language || null,
  };
}

export async function setGrantedRole({
  targetRef,
  nextRole,
  changedBy = "monarch",
}) {
  const role = normalizeGrantRole(nextRole);
  if (!role) {
    throw new Error("invalid_role");
  }

  const target = await resolveGrantTarget(targetRef);
  if (!target?.global_user_id) {
    return null;
  }

  const res = await pool.query(
    `
    UPDATE users
    SET role = $2
    WHERE global_user_id = $1
    RETURNING global_user_id, tg_user_id, role, language
    `,
    [target.global_user_id, role]
  );

  const row = res.rows?.[0] || null;
  if (!row) return null;

  return {
    global_user_id: row.global_user_id,
    tg_user_id: row.tg_user_id || null,
    role: String(row.role || "guest"),
    language: row.language || null,
    changed_by: changedBy,
  };
}

export async function revokeGrantedRole({
  targetRef,
  changedBy = "monarch",
}) {
  return setGrantedRole({
    targetRef,
    nextRole: "guest",
    changedBy,
  });
}