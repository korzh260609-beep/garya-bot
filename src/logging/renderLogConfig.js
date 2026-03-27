// ============================================================================
// src/logging/renderLogConfig.js
// STAGE SKELETON — Render log diagnosis config
// Purpose:
// - isolate env/config for log diagnosis pipeline
// - keep render log analysis limits configurable
// - no runtime wiring here
// ============================================================================

import { envIntRange, envStr } from "../core/config.js";

function truthy(v, def = false) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (!raw) return def;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

export const RENDER_LOG_DIAG_ENABLED = truthy(
  process.env.RENDER_LOG_DIAG_ENABLED,
  false
);

export const RENDER_LOG_MAX_INPUT_CHARS = envIntRange(
  "RENDER_LOG_MAX_INPUT_CHARS",
  12000,
  { min: 1000, max: 100000 }
);

export const RENDER_LOG_MAX_STACK_LINES = envIntRange(
  "RENDER_LOG_MAX_STACK_LINES",
  12,
  { min: 3, max: 50 }
);

export const RENDER_LOG_MAX_PATH_HINTS = envIntRange(
  "RENDER_LOG_MAX_PATH_HINTS",
  8,
  { min: 1, max: 30 }
);

export const RENDER_LOG_MAX_FILE_CANDIDATES = envIntRange(
  "RENDER_LOG_MAX_FILE_CANDIDATES",
  5,
  { min: 1, max: 20 }
);

export const RENDER_LOG_MAX_CODE_CONTEXT_LINES = envIntRange(
  "RENDER_LOG_MAX_CODE_CONTEXT_LINES",
  12,
  { min: 3, max: 50 }
);

export const RENDER_LOG_DIAG_MODE = envStr(
  "RENDER_LOG_DIAG_MODE",
  "skeleton"
).trim().toLowerCase();

export function getRenderLogDiagConfig() {
  return {
    enabled: RENDER_LOG_DIAG_ENABLED,
    mode: RENDER_LOG_DIAG_MODE,
    maxInputChars: RENDER_LOG_MAX_INPUT_CHARS,
    maxStackLines: RENDER_LOG_MAX_STACK_LINES,
    maxPathHints: RENDER_LOG_MAX_PATH_HINTS,
    maxFileCandidates: RENDER_LOG_MAX_FILE_CANDIDATES,
    maxCodeContextLines: RENDER_LOG_MAX_CODE_CONTEXT_LINES,
  };
}

export default {
  RENDER_LOG_DIAG_ENABLED,
  RENDER_LOG_MAX_INPUT_CHARS,
  RENDER_LOG_MAX_STACK_LINES,
  RENDER_LOG_MAX_PATH_HINTS,
  RENDER_LOG_MAX_FILE_CANDIDATES,
  RENDER_LOG_MAX_CODE_CONTEXT_LINES,
  RENDER_LOG_DIAG_MODE,
  getRenderLogDiagConfig,
};