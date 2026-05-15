// SG 2.0 migration readiness diagnostics suite.
// Purpose: define the read-only checks needed before any future migration execution.
// Routing into this suite must come from structured intent/capability selection, not keyword or phrase matching.

export const MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME = "migration_readiness";

export const MIGRATION_READINESS_DIAGNOSTICS_CHECKS = Object.freeze([
  "migration_governance",
  "migration_automatic_execution_preflight",
  "migration_manual_execution_dry_run",
  "migration_manual_execution_preflight",
  "migration_db_readiness",
]);

export function getMigrationReadinessDiagnosticsChecks() {
  return [...MIGRATION_READINESS_DIAGNOSTICS_CHECKS];
}

export function isMigrationReadinessDiagnosticsRequest(input = {}) {
  const intent = input.intent && typeof input.intent === "object" && !Array.isArray(input.intent)
    ? input.intent
    : {};

  return Boolean(
    intent.diagnosticsSuite === MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME
    || intent.capability === "migration_readiness"
    || intent.capability === "migration_automatic_execution_preflight"
    || intent.target === "migration_readiness"
    || intent.target === "migrations"
  );
}

export function buildMigrationReadinessDiagnosticsSuite(input = {}) {
  return {
    ok: true,
    type: "diagnostics_suite",
    name: MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME,
    mode: "read_only",
    requested: isMigrationReadinessDiagnosticsRequest(input),
    checks: getMigrationReadinessDiagnosticsChecks(),
    routing: {
      source: "structured_intent",
      keywordMatchingUsed: false,
      phraseMatchingUsed: false,
    },
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noMigrationExecution: true,
      noSqlMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export default {
  MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME,
  MIGRATION_READINESS_DIAGNOSTICS_CHECKS,
  getMigrationReadinessDiagnosticsChecks,
  isMigrationReadinessDiagnosticsRequest,
  buildMigrationReadinessDiagnosticsSuite,
};
