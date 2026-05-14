// SG 2.0 migration readiness diagnostics suite.
// Purpose: define the read-only checks needed before any future manual migration execution.

export const MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME = "migration_readiness";

export const MIGRATION_READINESS_DIAGNOSTICS_CHECKS = Object.freeze([
  "migration_governance",
  "migration_manual_execution_dry_run",
  "migration_manual_execution_preflight",
  "migration_db_readiness",
]);

export function getMigrationReadinessDiagnosticsChecks() {
  return [...MIGRATION_READINESS_DIAGNOSTICS_CHECKS];
}

export function isMigrationReadinessDiagnosticsRequest(input = {}) {
  const text = typeof input.text === "string" ? input.text.trim().toLowerCase() : "";

  if (!text) return false;

  return [
    "migration readiness",
    "migrations readiness",
    "migration preflight",
    "manual migration",
    "manual migrations",
    "готовность миграций",
    "готовность migration",
    "ручные миграции",
    "ручной запуск миграций",
    "перед запуском миграций",
    "db readiness",
  ].some((hint) => text.includes(hint));
}

export function buildMigrationReadinessDiagnosticsSuite(input = {}) {
  return {
    ok: true,
    type: "diagnostics_suite",
    name: MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME,
    mode: "read_only",
    requested: isMigrationReadinessDiagnosticsRequest(input),
    checks: getMigrationReadinessDiagnosticsChecks(),
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
