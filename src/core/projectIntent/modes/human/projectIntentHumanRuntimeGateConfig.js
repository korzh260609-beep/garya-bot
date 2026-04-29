// src/core/projectIntent/modes/human/projectIntentHumanRuntimeGateConfig.js
// ============================================================================
// HUMAN MODE RUNTIME GATE CONFIG
//
// Purpose:
// - define the explicit runtime gate for future Human Mode project/repo access.
// - keep Human Mode disconnected by default.
// - prevent accidental runtime connection without an accepted gate.
//
// Current status:
// - config skeleton only.
// - default is OFF.
// - importing this file does not connect Human Mode to runtime.
// ============================================================================

export const HUMAN_MODE_PROJECT_REPO_RUNTIME_GATE = Object.freeze({
  envName: "HUMAN_MODE_PROJECT_REPO_ENABLED",
  defaultEnabled: false,
});

function normalizeEnvFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isHumanModeProjectRepoRuntimeEnabled(env = process.env) {
  return normalizeEnvFlag(env?.[HUMAN_MODE_PROJECT_REPO_RUNTIME_GATE.envName]);
}

export default {
  HUMAN_MODE_PROJECT_REPO_RUNTIME_GATE,
  isHumanModeProjectRepoRuntimeEnabled,
};
