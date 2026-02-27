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
// === SAFE INTEGER WITH RANGE (V1) ===
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
  // runtime
  "NODE_ENV",
  "PORT",

  // command rate-limit (Stage 3.5)
  "CMD_RL_WINDOW_MS",
  "CMD_RL_MAX",

  // jobs
  "JOB_DLQ_ENABLED",

  // memory flags (not secrets)
  "MEMORY_ENABLED",
  "MEMORY_MODE",

  // build metadata (not secrets)
  "RENDER_GIT_COMMIT",
  "GIT_COMMIT",
  "RENDER_SERVICE_ID",
  "RENDER_INSTANCE_ID",
  "HOSTNAME",

  // ========================================================================
  // Stage 4.5 — Feature flags (not secrets)
  // ========================================================================
  "LINKING_V2",
  "DIAG_ROLES_V2",
]);

// allowlist-only snapshot (no secrets!)
export function getPublicEnvSnapshot() {
  const out = {};

  for (const key of PUBLIC_ENV_ALLOWLIST) {
    out[key] = envStr(key, "");
  }

  return out;
}

// ============================================================================
// === FEATURE FLAGS (Stage 4.5) ==============================================
// ============================================================================
// IMPORTANT: This is config-only. No wiring here.
// Consumers may switch behavior based on these flags in their own modules.
export function getFeatureFlags() {
  return {
    LINKING_V2: envBool("LINKING_V2", false),
    DIAG_ROLES_V2: envBool("DIAG_ROLES_V2", false),
  };
}
