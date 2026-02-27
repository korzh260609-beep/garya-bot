// ============================================================================
// src/core/config.js
// Centralized ENV helpers + Stage configs
// ============================================================================

// ===============================
// ENV HELPERS (CORE)
// ===============================

export function envStr(key, def = "") {
  const v = process.env[key];
  if (v === undefined || v === null || String(v).trim() === "") return def;
  return String(v);
}

export function envInt(key, def) {
  const raw = process.env[key];
  const num = Number(raw);
  if (!Number.isFinite(num)) return def;
  return Math.floor(num);
}

export function envIntRange(key, def, { min = -Infinity, max = Infinity } = {}) {
  const raw = process.env[key];
  const num = Number(raw);

  if (!Number.isFinite(num)) return def;

  if (num < min) return min;
  if (num > max) return max;

  return Math.floor(num);
}

export function getPublicEnvSnapshot() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    MEMORY_ENABLED: process.env.MEMORY_ENABLED,
    MEMORY_MODE: process.env.MEMORY_MODE,
    RENDER_GIT_COMMIT: process.env.RENDER_GIT_COMMIT,
    RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
    RENDER_INSTANCE_ID: process.env.RENDER_INSTANCE_ID,
    GIT_COMMIT: process.env.GIT_COMMIT,
    HOSTNAME: process.env.HOSTNAME,
  };
}

// ===============================
// STAGE 5.15 — ADMIN ALERTS CONFIG
// ===============================

export const ADMIN_ALERTS_ENABLED =
  String(process.env.ADMIN_ALERTS_ENABLED || "true").toLowerCase() === "true";

export const ADMIN_ALERT_DB_WARN_PCT = envIntRange(
  "ADMIN_ALERT_DB_WARN_PCT",
  70,
  { min: 50, max: 95 }
);

export const ADMIN_ALERT_DB_CRIT_PCT = envIntRange(
  "ADMIN_ALERT_DB_CRIT_PCT",
  85,
  { min: 60, max: 99 }
);

export const ADMIN_ALERT_COOLDOWN_MIN = envIntRange(
  "ADMIN_ALERT_COOLDOWN_MIN",
  30,
  { min: 1, max: 1440 }
);

// ===============================
// FEATURE FLAGS
// ===============================

export const PUBLIC_ENV_ALLOWLIST = [
  "NODE_ENV",
  "MEMORY_ENABLED",
  "MEMORY_MODE",
  "RENDER_GIT_COMMIT",
  "RENDER_SERVICE_ID",
  "RENDER_INSTANCE_ID",
  "GIT_COMMIT",
  "HOSTNAME",
  "LINKING_V2",
  "DIAG_ROLES_V2",
];

function _isTruthyFlag(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

export function getFeatureFlags() {
  return {
    LINKING_V2: _isTruthyFlag(envStr("LINKING_V2", "0")),
    DIAG_ROLES_V2: _isTruthyFlag(envStr("DIAG_ROLES_V2", "0")),
  };
}
