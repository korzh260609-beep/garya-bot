// SG 2.0 Project Memory production readiness diagnostics suite.
// Purpose: define the read-only checks needed to verify Project Memory production readiness from live evidence.
// Routing into this suite must come from structured intent/capability selection, not keyword or phrase matching.
// This suite does not execute migrations, write DB, write Project Memory, call AI, touch Telegram, fetch GitHub/Render, or mutate runtime/repository state.

export const PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME = "project_memory_production_readiness";

export const PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_CHECKS = Object.freeze([
  "project_memory_runtime",
  "project_memory_live_db",
  "project_memory_production_readiness",
]);

export function getProjectMemoryProductionReadinessDiagnosticsChecks() {
  return [...PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_CHECKS];
}

export function isProjectMemoryProductionReadinessDiagnosticsRequest(input = {}) {
  const intent = input.intent && typeof input.intent === "object" && !Array.isArray(input.intent)
    ? input.intent
    : {};

  return Boolean(
    intent.diagnosticsSuite === PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME
    || intent.capability === PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME
    || intent.capability === "project_memory_readiness"
    || intent.target === PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME
    || intent.target === "project_memory"
  );
}

export function buildProjectMemoryProductionReadinessDiagnosticsSuite(input = {}) {
  return {
    ok: true,
    type: "diagnostics_suite",
    name: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
    mode: "read_only",
    requested: isProjectMemoryProductionReadinessDiagnosticsRequest(input),
    checks: getProjectMemoryProductionReadinessDiagnosticsChecks(),
    routing: {
      source: "structured_intent",
      keywordMatchingUsed: false,
      phraseMatchingUsed: false,
    },
    safety: {
      noDbMutation: true,
      noProjectMemoryWrite: true,
      noConfirmedMemoryWrite: true,
      noCandidateConfirmation: true,
      noRuntimeFileWrite: true,
      noRepositoryMutation: true,
      noEnvironmentMutation: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noGitHubFetch: true,
      noRenderFetch: true,
      noRawLogs: true,
      noSecrets: true,
    },
  };
}

export default {
  PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
  PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_CHECKS,
  getProjectMemoryProductionReadinessDiagnosticsChecks,
  isProjectMemoryProductionReadinessDiagnosticsRequest,
  buildProjectMemoryProductionReadinessDiagnosticsSuite,
};
