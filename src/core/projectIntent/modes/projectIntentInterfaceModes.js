// src/core/projectIntent/modes/projectIntentInterfaceModes.js
// ============================================================================
// PROJECT INTENT INTERFACE MODES
//
// Purpose:
// - keep Human Mode and Technical Mode explicit and physically separated.
// - prevent accidental mixing of normal SG conversation with legacy command /
//   phrase / keyword / regex routing.
// ============================================================================

export const PROJECT_INTENT_INTERFACE_MODES = Object.freeze({
  HUMAN: "human",
  TECHNICAL: "technical",
});

export const PROJECT_INTENT_MODE_NOTES = Object.freeze({
  human:
    "Human Mode is normal SG conversation by meaning. It must not depend on slash commands, exact phrases, exact keywords or regex routes.",
  technical:
    "Technical Mode is explicit commands, diagnostics, tests, debug paths and legacy phrase/keyword/regex routing.",
});

export function isHumanMode(value) {
  return value === PROJECT_INTENT_INTERFACE_MODES.HUMAN;
}

export function isTechnicalMode(value) {
  return value === PROJECT_INTENT_INTERFACE_MODES.TECHNICAL;
}

export default {
  PROJECT_INTENT_INTERFACE_MODES,
  PROJECT_INTENT_MODE_NOTES,
  isHumanMode,
  isTechnicalMode,
};
