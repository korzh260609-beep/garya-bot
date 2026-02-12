// ============================================================================
// === src/codeOutput/codeOutputMode.js
// === STAGE 12A: centralized CODE_OUTPUT_MODE (ENV)
// === Modes: DISABLED | DRY_RUN | ENABLED
// === Default: DISABLED
// ============================================================================

export const CODE_OUTPUT_MODES = {
  DISABLED: "DISABLED",
  DRY_RUN: "DRY_RUN",
  ENABLED: "ENABLED",
};

function normalizeMode(raw) {
  const v = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, "_");

  // Allow simple toggles
  if (v === "0" || v === "OFF" || v === "FALSE") return CODE_OUTPUT_MODES.DISABLED;
  if (v === "1" || v === "ON" || v === "TRUE") return CODE_OUTPUT_MODES.ENABLED;

  if (v === "DISABLED") return CODE_OUTPUT_MODES.DISABLED;
  if (v === "DRY_RUN") return CODE_OUTPUT_MODES.DRY_RUN;
  if (v === "ENABLED") return CODE_OUTPUT_MODES.ENABLED;

  // safe fallback
  return CODE_OUTPUT_MODES.DISABLED;
}

export function getCodeOutputMode() {
  return normalizeMode(process.env.CODE_OUTPUT_MODE);
}

export function isCodeOutputDisabled() {
  return getCodeOutputMode() === CODE_OUTPUT_MODES.DISABLED;
}

export function isCodeOutputDryRun() {
  return getCodeOutputMode() === CODE_OUTPUT_MODES.DRY_RUN;
}

export function isCodeOutputEnabled() {
  return getCodeOutputMode() === CODE_OUTPUT_MODES.ENABLED;
}

