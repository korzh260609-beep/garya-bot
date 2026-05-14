// AGENT NOTE:
// SG 2.0 manual migration execution preflight boundary.
// Purpose: expose safe readiness visibility before any manual migration execution is allowed.
// Do not execute migrations, open transactions, run SQL, write ledger rows, add startup hooks, call AI, touch Telegram, or write Project Memory here.

import { isDatabaseConfigured, withPostgresTransaction } from "../postgresClient.js";
import { buildMigrationExecutionDecision } from "./migrationExecutionController.js";
import { canRunManualMigrationExecution } from "./migrationManualExecutionBoundary.js";
import { buildMigrationPlan } from "./migrationRunner.js";
import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";

export const MIGRATION_MANUAL_EXECUTION_PREFLIGHT_VERSION = 1;

export const MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS = Object.freeze({
  READY_FOR_REVIEW: "manual_migration_execution_preflight_ready_for_review",
  DATABASE_NOT_CONFIGURED: "manual_migration_execution_preflight_database_not_configured",
  REGISTRY_INVALID: "manual_migration_execution_preflight_registry_invalid",
  EXECUTION_STILL_BLOCKED: "manual_migration_execution_preflight_execution_still_blocked",
});

function hasTransactionBoundary(value) {
  return typeof value === "function";
}

function summarizeMigrations(migrations = []) {
  return migrations.map((migration) => ({
    id: migration?.id || null,
    name: migration?.name || null,
    module: migration?.module || "core",
    sqlCount: Array.isArray(migration?.upSql) ? migration.upSql.length : 0,
  }));
}

export function buildManualMigrationExecutionPreflight({
  registry,
  databaseConfigured = isDatabaseConfigured(),
  transactionBoundary = withPostgresTransaction,
} = {}) {
  const migrations = getRegisteredMigrations({ registry });
  const registryValidation = validateMigrationRegistry({ registry });
  const runnerPlan = buildMigrationPlan({ registry });
  const executionDecision = buildMigrationExecutionDecision({
    runnerPlan,
    databaseConfigured,
  });
  const manualBoundary = canRunManualMigrationExecution({
    decision: executionDecision,
    registry,
    withTransaction: transactionBoundary,
  });

  const transactionBoundaryAvailable = hasTransactionBoundary(transactionBoundary);
  const executionStillBlocked = manualBoundary.ok === false;
  const dbConfigured = Boolean(databaseConfigured);
  const registryOk = registryValidation.ok === true;

  let reason = MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.READY_FOR_REVIEW;

  if (!registryOk) {
    reason = MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.REGISTRY_INVALID;
  } else if (!dbConfigured) {
    reason = MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.DATABASE_NOT_CONFIGURED;
  } else if (executionStillBlocked) {
    reason = MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.EXECUTION_STILL_BLOCKED;
  }

  return {
    ok: registryOk && dbConfigured && transactionBoundaryAvailable && executionStillBlocked,
    type: "manual_migration_execution_preflight",
    version: MIGRATION_MANUAL_EXECUTION_PREFLIGHT_VERSION,
    mode: "read_only_preflight",
    reason,
    summary: "Manual migration execution preflight completed without opening a transaction or mutating the database.",
    willMutateDatabase: false,
    database: {
      configured: dbConfigured,
      checked: true,
      secretExposed: false,
    },
    transaction: {
      boundaryAvailable: transactionBoundaryAvailable,
      opened: false,
      committed: false,
      rolledBack: false,
    },
    execution: {
      attempted: false,
      decision: executionDecision.decision,
      reason: executionDecision.reason,
      manualBoundaryAllowed: manualBoundary.ok === true,
      manualBoundaryReason: manualBoundary.reason,
      stillBlocked: executionStillBlocked,
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
    migrations: summarizeMigrations(migrations),
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
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_VERSION,
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS,
  buildManualMigrationExecutionPreflight,
};
