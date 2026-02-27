// src/core/config.js
// Stage 3.6 — Config/Secrets hygiene V1 (ESM)
// Centralized env access + validation + public allowlist

// ============================================================================
// === BASIC READERS ===
// ============================================================================

export function envStr(name, def = "") {
  const v = process.env[name];
  if (v == null || v === "") return def;
  return String(v);
}

export function envInt(name, def) {
  const raw = process.env[name];
  if (raw == null || raw === "") return def;

  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

export function envBool(name, def = false) {
  const raw = String(process.env[name] || "").toLowerCase();
  if (!raw) return def;
  return raw === "true" || raw === "1" || raw === "yes" || raw === "y";
}

// ============================================================================
// === SAFE INTEGER WITH RANGE (NEW V1) ===
// ============================================================================

export function envIntRange(name, def, { min = null, max = null } = {}) {
  let value = envInt(name, def);

  if (typeof min === "number" && value < min) value = min;
  if (typeof max === "number" && value > max) value = max;

  return value;
}

// ============================================================================
// === PUBLIC ENV ALLOWLIST (NO SECRETS EVER) ===
// ============================================================================

const PUBLIC_ENV_ALLOWLIST = new Set([
  "NODE_ENV",
  "PORT",
  "CMD_RL_WINDOW_MS",
  "CMD_RL_MAX",
  "JOB_DLQ_ENABLED"
]);

// allowlist-only snapshot (no secrets!)
export function getPublicEnvSnapshot() {
  const out = {};

  for (const key of PUBLIC_ENV_ALLOWLIST) {
    out[key] = envStr(key, "");
  }

  return out;
}
