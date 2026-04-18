// src/bot/handlers/projectAccessScope.js
// ============================================================================
// SG project-only scope registry
// Purpose:
// - single source of truth for commands/features related to internal SG project work
// - repo/github/project architecture access must be monarch-only
// - read-only repo access only; NO repo write actions here
// ============================================================================

function normalizeCommand(value) {
  return String(value || "").trim().split("@")[0].toLowerCase();
}

export const PROJECT_ONLY_FEATURES = Object.freeze({
  PROJECT_REPO_ACCESS: "project_repo_access",
  PROJECT_CODE_ANALYSIS: "project_code_analysis",
  PROJECT_STAGE_CHECK: "project_stage_check",
  PROJECT_ARCHITECTURE_ACCESS: "project_architecture_access",
  PROJECT_PATCH_GENERATION: "project_patch_generation",
});

export const PROJECT_ONLY_COMMAND_TO_FEATURE = Object.freeze({
  "/reindex": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,

  "/repo_status": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,
  "/repo_tree": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,
  "/repo_file": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,
  "/repo_search": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,
  "/repo_get": PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,

  "/repo_analyze": PROJECT_ONLY_FEATURES.PROJECT_CODE_ANALYSIS,
  "/repo_check": PROJECT_ONLY_FEATURES.PROJECT_CODE_ANALYSIS,
  "/repo_review": PROJECT_ONLY_FEATURES.PROJECT_CODE_ANALYSIS,
  "/repo_review2": PROJECT_ONLY_FEATURES.PROJECT_CODE_ANALYSIS,

  "/workflow_check": PROJECT_ONLY_FEATURES.PROJECT_STAGE_CHECK,
  "/stage_check": PROJECT_ONLY_FEATURES.PROJECT_STAGE_CHECK,

  "/repo_diff": PROJECT_ONLY_FEATURES.PROJECT_PATCH_GENERATION,
  "/code_output_status": PROJECT_ONLY_FEATURES.PROJECT_PATCH_GENERATION,

  "/project_intent_diag": PROJECT_ONLY_FEATURES.PROJECT_ARCHITECTURE_ACCESS,
});

export const PROJECT_ONLY_COMMANDS = Object.freeze(
  new Set(Object.keys(PROJECT_ONLY_COMMAND_TO_FEATURE))
);

export const PROJECT_READ_ONLY_FEATURES = Object.freeze(
  new Set([
    PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS,
    PROJECT_ONLY_FEATURES.PROJECT_CODE_ANALYSIS,
    PROJECT_ONLY_FEATURES.PROJECT_STAGE_CHECK,
    PROJECT_ONLY_FEATURES.PROJECT_ARCHITECTURE_ACCESS,
    PROJECT_ONLY_FEATURES.PROJECT_PATCH_GENERATION,
  ])
);

export function isProjectOnlyCommand(command) {
  const cmd = normalizeCommand(command);
  return PROJECT_ONLY_COMMANDS.has(cmd);
}

export function resolveProjectFeatureByCommand(command) {
  const cmd = normalizeCommand(command);
  return (
    PROJECT_ONLY_COMMAND_TO_FEATURE[cmd] ||
    PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS
  );
}

export function isProjectReadOnlyFeature(feature) {
  return PROJECT_READ_ONLY_FEATURES.has(String(feature || "").trim());
}

// Legacy helper kept only as a lightweight compatibility helper.
// Real free-text classification now lives in:
// src/core/projectIntent/projectIntentScope.js
// and is enforced in:
// src/core/projectIntent/projectIntentGuard.js
export function isLikelyProjectInternalText(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) return false;

  return (
    lower.includes("sg project") ||
    lower.includes("советник garya") ||
    lower.includes("garya-bot") ||
    lower.includes("repo") ||
    lower.includes("repository") ||
    lower.includes("github") ||
    lower.includes("workflow") ||
    lower.includes("roadmap") ||
    lower.includes("pillars") ||
    lower.includes("stage-check") ||
    lower.includes("stage check") ||
    lower.includes("архитектур") ||
    lower.includes("архитектура") ||
    lower.includes("репозитор") ||
    lower.includes("код проекта") ||
    lower.includes("проект sg")
  );
}

export default {
  PROJECT_ONLY_FEATURES,
  PROJECT_ONLY_COMMAND_TO_FEATURE,
  PROJECT_ONLY_COMMANDS,
  PROJECT_READ_ONLY_FEATURES,
  isProjectOnlyCommand,
  resolveProjectFeatureByCommand,
  isProjectReadOnlyFeature,
  isLikelyProjectInternalText,
};