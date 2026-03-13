// src/users/grants.js
// Stage 11.12 — Grants V1.1
// PURPOSE:
// - monarch-only role management without direct SQL
// - canonical target_ref = global_user_id
// - provider-specific ids are only convenience fallback
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

function normalizeTargetRef(targetRef) {
  const raw = String(targetRef || "").trim();
  if (!raw) {
    return {
      raw: "",
      kind: "empty",
      globalUserId: null,
      provider: null,
      providerUserId: null,
      numericTelegramId: null,
    };
  }

  const lower = raw.toLowerCase();

  // Explicit provider prefix: tg:123456 or telegram:123456
  if (lower.startsWith("tg:")) {
    const providerUserId = raw.slice(3).trim();
    return {
      raw,
      kind: "provider_explicit",
      globalUserId: null,
      provider: "telegram",
      providerUserId,
      numericTelegramId: /^\d+$/.test(providerUserId) ? providerUserId : null,
    };
  }

  if (lower.startsWith("telegram:")) {
    const providerUserId = raw.slice("telegram:".length).trim();
    return {
      raw,
      kind: "provider_explicit",
      globalUserId: null,
      provider: "telegram",
      providerUserId,
      numericTelegramId: /^\d+$/.test(providerUserId) ? providerUserId : null,
    };
  }

  // Numeric fallback = likely telegram id (temporary convenience path)
  if (/^\d+$/.test(raw)) {
    return {
      raw,
      kind: "numeric_fallback",
      globalUserId: null,
      provider: "telegram",
      providerUserId: raw,
      numericTelegramId: raw,
    };
  }

  // Canonical path = exact global_user_id
  return {
    raw,
    kind: "global_user_id",
    globalUserId: raw,
    provider: null,
    providerUserId: null,
    numericTelegramId: null,
  };
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

async function findUserByIdentityProviderUserId(provider, providerUserId) {
  const providerNorm = String(provider || "").trim().toLowerCase();
  const raw = String(providerUserId || "").trim();

  if (!providerNorm || !raw) return null;

  const res = await pool.query(
    `
    SELECT u.global_user_id, u.tg_user_id, u.role, u.language
    FROM user_identities ui
    JOIN users u
      ON u.global_user_id = ui.global_user_id
    WHERE ui.provider = $1
      AND ui.provider_user_id = $2
    LIMIT 1
    `,
    [providerNorm, raw]
  );

  return res.rows?.[0] || null;
}

export async function resolveGrantTarget(targetRef) {
  const target = normalizeTargetRef(targetRef);

  if (target.kind === "empty") return null;

  // 1) Canonical path: exact global_user_id
  if (target.globalUserId) {
    const user = await findUserByGlobalUserId(target.globalUserId);
    if (user) return user;
  }

  // 2) Explicit provider path
  if (target.provider && target.providerUserId) {
    const byIdentity = await findUserByIdentityProviderUserId(
      target.provider,
      target.providerUserId
    );
    if (byIdentity) return byIdentity;

    // Legacy telegram fallback through users.tg_user_id
    if (target.provider === "telegram" && target.numericTelegramId) {
      const byLegacyTg = await findUserByTelegramUserId(target.numericTelegramId);
      if (byLegacyTg) return byLegacyTg;
    }
  }

  // 3) Numeric telegram convenience fallback
  if (target.numericTelegramId) {
    const byIdentity = await findUserByIdentityProviderUserId(
      "telegram",
      target.numericTelegramId
    );
    if (byIdentity) return byIdentity;

    const byLegacyTg = await findUserByTelegramUserId(target.numericTelegramId);
    if (byLegacyTg) return byLegacyTg;
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

  const previousRole = String(target.role || "guest");

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
    previous_role: previousRole,
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