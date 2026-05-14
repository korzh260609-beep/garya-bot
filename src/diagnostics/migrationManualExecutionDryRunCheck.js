// AGENT NOTE:
// SG 2.0 manual migration execution dry-run diagnostics.
// Purpose: expose read-only visibility that the manual execution path is assembled but not run automatically.
// Do not execute migrations, open transactions, import postgresClient, add startup hooks, call AI, touch Telegram, or write Project Memory here.

import { buildMigrationExecutionDecision } from "../db/migrations/migrationExecutionController.js";
import {
  canRunManualMigrationExecution,
  MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION,
} from "../db/migrations/migrationManualExecutionBoundary.js";
import { buildMigrationPlan } from "../db/migrations/migrationRunner.js";
import { getRegisteredMigrations, validateMigrationRegistry } from "../db/migrations/migrationRegistry.js";

export const MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME = "migration_manual_execution_dry_run";
export const MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_VERSION = 1;

function summarizeMigrations(migrations = []) {
  return migrations.map((migration) => ({
    id: migration?.id || null,
    name: migration?.name || null,
    module: migration?.module || "core",
    sqlCount: Array.isArray(migration?.upSql) ? migration.upSql.length : 0,
  }));
}

export function runMigrationManualExecutionDryRunCheck({ registry } = {}) {
  const migrations = getRegisteredMigrations({ registry });
  const registryValidation = validateMigrationRegistry({ registry });
  const runnerPlan = buildMigrationPlan({ registry });
  const executionDecision = buildMigrationExecutionDecision({
    runnerPlan,
  });
  const manualBoundary = canRunManualMigrationExecution({
    decision: executionDecision,
    registry,
    withTransaction: null,
  });

  const willMutateDatabase = Boolean(
    runnerPlan.willMutateDatabase
    || executionDecision.willMutateDatabase
    || manualBoundary.willMutateDatabase
  );

  const automaticExecutionBlocked = executionDecision.decision !== "ready_for_future_execution";
  const manualExecutionBlocked = manualBoundary.ok === false;
  const dryRunOnly = willMutateDatabase === false;

  return {
    ok: registryValidation.ok === true
      && runnerPlan.ok === true
      && automaticExecutionBlocked === true
      && manualExecutionBlocked === true
      && dryRunOnly === true,
    type: "diagnostics_check",
    name: MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME,
    version: MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_VERSION,
    summary: "Manual migration execution dry-run visibility OK: execution path is assembled, automatic execution is blocked, and no DB mutation is attempted.",
    mode: "read_only_dry_run_visibility",
    willMutateDatabase,
    executionPath: {
      assembled: true,
      manualBoundaryVersion: MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION,
      migrationCount: migrations.length,
      migrations: summarizeMigrations(migrations),
    },
    automaticExecution: {
      blocked: automaticExecutionBlocked,
      decision: executionDecision.decision,
      reason: executionDecision.reason,
      willMutateDatabase: executionDecision.willMutateDatabase,
    },
    manualExecution: {
      attempted: false,
      allowed: manualBoundary.ok === true,
      blocked: manualExecutionBlocked,
      reason: manualBoundary.reason,
      migrationCount: manualBoundary.migrationCount,
      transactionBoundaryInjected: false,
      transactionOpened: false,
      sqlExecuted: false,
      ledgerWritten: false,
      willMutateDatabase: false,
    },
    registryValidation,
    runnerPlan: {
      ok: runnerPlan.ok,
      type: runnerPlan.type,
      mode: runnerPlan.mode,
      willMutateDatabase: runnerPlan.willMutateDatabase,
      migrationCount: runnerPlan.migrations.length,
    },
    safety: {
      dryRunOnly,
      noDbMutation: willMutateDatabase === false,
      noTransactionOpened: true,
      noSqlExecution: true,
      noLedgerWrite: true,
      noStartupExecution: true,
      noRunMigrationsOnBootEnable: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      noDirectPostgresImport: true,
    },
  };
}

export default {
  MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME,
  MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_VERSION,
  runMigrationManualExecutionDryRunCheck,
};
