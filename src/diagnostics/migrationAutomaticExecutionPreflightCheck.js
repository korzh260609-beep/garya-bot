// AGENT NOTE:
// SG 2.0 automatic migration execution preflight diagnostics.
// Purpose: expose safe preflight visibility for automatic migration execution readiness.
// Do not execute migrations, acquire advisory locks, open transactions, run SQL, write ledger rows, add startup hooks, call AI, touch Telegram, or write Project Memory here.

import { buildAutomaticMigrationExecutionPreflight } from "../db/migrations/migrationAutomaticExecutionPreflight.js";

export const MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME = "migration_automatic_execution_preflight";
export const MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_VERSION = 1;

export function runMigrationAutomaticExecutionPreflightCheck(options = {}) {
  const preflight = buildAutomaticMigrationExecutionPreflight(options);

  return {
    ok: Boolean(preflight.ok),
    type: "diagnostics_check",
    name: MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME,
    version: MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_VERSION,
    summary: preflight.ok
      ? "Automatic migration execution preflight OK: automatic path is inspectable and still blocked until separate env-gate approval."
      : "Automatic migration execution preflight needs attention; no migration execution was attempted.",
    mode: "read_only_automatic_preflight_visibility",
    willMutateDatabase: false,
    preflight,
    safety: {
      readOnly: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noAdvisoryLockAcquire: true,
      noSqlExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      noMigrationExecution: true,
      executionStillRequiresSeparateApproval: true,
      envGatesNotChanged: true,
    },
  };
}

export default {
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME,
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_VERSION,
  runMigrationAutomaticExecutionPreflightCheck,
};
