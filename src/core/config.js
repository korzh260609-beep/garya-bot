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

export function envBool(key, def = false) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return Boolean(def);
  }

  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(value)) return true;
  if (["0", "false", "no", "n", "off"].includes(value)) return false;

  return Boolean(def);
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
// STAGE 5.16 — ERROR EVENTS CONFIG
// ===============================

export const ERROR_EVENTS_RETENTION_DAYS = envIntRange(
  "ERROR_EVENTS_RETENTION_DAYS",
  30,
  { min: 1, max: 3650 }
);

export const ERROR_EVENTS_IGNORE_TEST_FAIL =
  String(process.env.ERROR_EVENTS_IGNORE_TEST_FAIL || "true").toLowerCase() ===
  "true";

export const ERROR_EVENTS_PURGE_COOLDOWN_MIN = envIntRange(
  "ERROR_EVENTS_PURGE_COOLDOWN_MIN",
  60,
  { min: 1, max: 1440 }
);

// ===============================
// STAGE 12.1 / 12.2 — VISION / OCR CONFIG
// ===============================

export const VISION_ENABLED = envBool("VISION_ENABLED", false);

// values:
// - none
// - noop
// - gemini
// - claude
// - openai
// - auto
export const VISION_PROVIDER = envStr("VISION_PROVIDER", "noop")
  .trim()
  .toLowerCase();

export const VISION_OCR_ENABLED = envBool("VISION_OCR_ENABLED", false);

// Extract-only policy for current stage:
// no semantic analysis, no long-form reasoning here.
export const VISION_EXTRACT_ONLY = envBool("VISION_EXTRACT_ONLY", true);

// Safety/cost guard for future provider calls
export const VISION_MAX_FILE_MB = envIntRange("VISION_MAX_FILE_MB", 10, {
  min: 1,
  max: 50,
});

export const VISION_TIMEOUT_MS = envIntRange("VISION_TIMEOUT_MS", 15000, {
  min: 1000,
  max: 120000,
});

// Auto-selection mode:
// - cheapest_acceptable  -> choose cheapest provider that passes quality threshold
// - manual              -> use exact VISION_PROVIDER
export const VISION_PROVIDER_SELECTION_MODE = envStr(
  "VISION_PROVIDER_SELECTION_MODE",
  "cheapest_acceptable"
)
  .trim()
  .toLowerCase();

// Required minimum quality score in auto mode.
// Current stage uses coarse integer scoring only.
export const VISION_MIN_QUALITY_SCORE = envIntRange(
  "VISION_MIN_QUALITY_SCORE",
  60,
  { min: 1, max: 100 }
);

// Feature flags for provider availability (skeleton-level)
export const VISION_PROVIDER_NOOP_ENABLED = envBool(
  "VISION_PROVIDER_NOOP_ENABLED",
  true
);
export const VISION_PROVIDER_GEMINI_ENABLED = envBool(
  "VISION_PROVIDER_GEMINI_ENABLED",
  false
);
export const VISION_PROVIDER_CLAUDE_ENABLED = envBool(
  "VISION_PROVIDER_CLAUDE_ENABLED",
  false
);
export const VISION_PROVIDER_OPENAI_ENABLED = envBool(
  "VISION_PROVIDER_OPENAI_ENABLED",
  false
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
  "VISION_ENABLED",
  "VISION_PROVIDER",
  "VISION_OCR_ENABLED",
  "VISION_EXTRACT_ONLY",
  "VISION_MAX_FILE_MB",
  "VISION_TIMEOUT_MS",
  "VISION_PROVIDER_SELECTION_MODE",
  "VISION_MIN_QUALITY_SCORE",
  "VISION_PROVIDER_NOOP_ENABLED",
  "VISION_PROVIDER_GEMINI_ENABLED",
  "VISION_PROVIDER_CLAUDE_ENABLED",
  "VISION_PROVIDER_OPENAI_ENABLED",
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

    // Stage 12
    VISION_ENABLED,
    VISION_OCR_ENABLED,
    VISION_EXTRACT_ONLY,
    VISION_PROVIDER_SELECTION_MODE:
      VISION_PROVIDER_SELECTION_MODE || "cheapest_acceptable",
  };
}