// AGENT NOTE:
// SG 2.0 explicit diagnostics command bridge.
// Purpose: convert explicit, allowlisted diagnostics command tokens from plain message text into structured checks.
// This is not general natural-language intent inference and must stay small, deterministic, and transport-independent.

const PROJECT_MEMORY_ENTRY_LOOKUP_CHECK = "project_memory_entry_lookup";
const ALLOWED_TEXT_COMMAND_CHECKS = Object.freeze([
  PROJECT_MEMORY_ENTRY_LOOKUP_CHECK,
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIntent(value = null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function includesExplicitCheckToken(text, checkName) {
  const safeText = normalizeText(text).toLowerCase();
  const safeCheckName = normalizeText(checkName).toLowerCase();
  if (!safeText || !safeCheckName) return false;

  return safeText.includes(safeCheckName);
}

export function buildDiagnosticsCommandBridgeIntent({ text = "", intent = null } = {}) {
  const existingIntent = normalizeIntent(intent);

  if (existingIntent) {
    return {
      intent: existingIntent,
      source: "existing_structured_intent",
      changed: false,
      matchedCheck: null,
    };
  }

  for (const checkName of ALLOWED_TEXT_COMMAND_CHECKS) {
    if (!includesExplicitCheckToken(text, checkName)) continue;

    return {
      intent: {
        domain: "diagnostics",
        action: "inspect",
        checks: [checkName],
        source: "explicit_diagnostics_command_bridge",
      },
      source: "explicit_diagnostics_command_bridge",
      changed: true,
      matchedCheck: checkName,
    };
  }

  return {
    intent: null,
    source: "none",
    changed: false,
    matchedCheck: null,
  };
}

export default {
  buildDiagnosticsCommandBridgeIntent,
};
