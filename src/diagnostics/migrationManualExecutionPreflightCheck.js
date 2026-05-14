// AGENT NOTE:
// SG 2.0 manual migration execution preflight diagnostics.
// Purpose: expose safe preflight visibility for manual migration execution readiness.
// Do not execute migrations, open transactions, run SQL, write ledger rows, add startup hooks, call AI, touch Telegram, or write Project Memory here.

import { buildManualMigrationExecutionPreflight } from "../db/migrations/migrationManualExecutionPreflight.js";

export const MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME = "migration_manual_execution_preflight";
export const MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_VERSION = 1;

export function runMigrationManualExecutionPreflightCheck(options = {}) {
  const preflight = buildManualMigrationExecutionPreflight(options);

  return {
    ok: Boolean(preflight.ok),
    type: "diagnostics_check",
    name: MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME,
    version: MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_VERSION,
    summary: preflight.ok
      ? "Manual migration execution preflight OK: DB is configured, transaction boundary exists, and execution remains blocked until separately approved."
      : "Manual migration execution preflight needs attention; no migration execution was attempted.",
    mode: "read_only_preflight_visibility",
    willMutateDatabase: false,
    preflight,
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noLedgerWrite: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      noMigrationExecution: true,
      executionStillRequiresSeparateApproval: true,
    },
  };
}

export default {
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME,
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_VERSION,
  runMigrationManualExecutionPreflightCheck,
};
