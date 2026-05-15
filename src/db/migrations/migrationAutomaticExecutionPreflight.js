// AGENT NOTE:
// SG 2.0 automatic migration execution preflight boundary.
// Purpose: expose safe readiness visibility before any automatic migration execution is enabled.
// Do not execute migrations, acquire advisory locks, open transactions, run SQL, write ledger rows, add startup hooks, call AI, touch Telegram, or write Project Memory here.

import { isDatabaseConfigured, withPostgresTransaction } from "../postgresClient.js";
import { buildMigrationAutomaticExecutionPlan } from "./migrationAutomaticExecutor.js";
import { buildMigrationExecutionDecision } from "./migrationExecutionController.js";
import { buildMigrationExecutionGuard } from "./migrationExecutionGuard.js";
import { buildMigrationExecutionLockPlan } from "./migrationExecutionLock.js";
import { buildMigrationLedgerPlan } from "./migrationLedger.js";
import { buildMigrationPendingDetectionPlan } from "./migrationPendingDetector.js";
import { buildMigrationPlan } from "./migrationRunner.js";
import { getMigrationRuntimeConfigFromEnv } from "./migrationRuntimeConfig.js";
import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";

export const MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_VERSION = 1;

export const MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS = Object.freeze({
  READY_FOR_REVIEW: "automatic_migration_execution_preflight_ready_for_review",
  DATABASE_NOT_CONFIGURED: "automatic_migration_execution_preflight_database_not_configured",
  REGISTRY_INVALID: "automatic_migration_execution_preflight_registry_invalid",
  TRANSACTION_BOUNDARY_MISSING: "automatic_migration_execution_preflight_transaction_boundary_missing",
  EXECUTION_STILL_BLOCKED: "automatic_migration_execution_preflight_execution_still_blocked",
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

function buildApprovedRuntimeConfigForPreflight(runtimeConfig = getMigrationRuntimeConfigFromEnv()) {
  return {
    ...runtimeConfig,
    env: {
      ...(runtimeConfig.env || {}),
      runMigrationsOnBoot: {
        ...(runtimeConfig.env?.runMigrationsOnBoot || {}),
        key: runtimeConfig.env?.runMigrationsOnBoot?.key || "RUN_MIGRATIONS_ON_BOOT",
        configured: true,
        enabled: true,
      },
      approveMigrationsOnBoot: {
        ...(runtimeConfig.env?.approveMigrationsOnBoot || {}),
        key: runtimeConfig.env?.approveMigrationsOnBoot?.key || "APPROVE_MIGRATIONS_ON_BOOT",
        configured: true,
        enabled: true,
      },
    },
    gates: {
      automaticExecutionRequested: true,
      automaticExecutionApproved: true,
      automaticExecutionAllowed: true,
    },
  };
}

export function buildAutomaticMigrationExecutionPreflight({
  registry,
  databaseConfigured = isDatabaseConfigured(),
  transactionBoundary = withPostgresTransaction,
  runtimeConfig = getMigrationRuntimeConfigFromEnv(),
  ledgerRows = [],
  ledgerReadModel = null,
  simulateApprovedGates = true,
} = {}) {
  const migrations = getRegisteredMigrations({ registry });
  const registryValidation = validateMigrationRegistry({ registry });
  const runnerPlan = buildMigrationPlan({ registry });
  const ledgerPlan = buildMigrationLedgerPlan();
  const runtimeConfigForReadiness = simulateApprovedGates
    ? buildApprovedRuntimeConfigForPreflight(runtimeConfig)
    : runtimeConfig;
  const executionGuard = buildMigrationExecutionGuard({ runtimeConfig: runtimeConfigForReadiness });
  const executionDecision = buildMigrationExecutionDecision({
    runtimeConfig: runtimeConfigForReadiness,
    guard: executionGuard,
    runnerPlan,
    ledgerPlan,
    databaseConfigured,
  });
  const pendingDetection = buildMigrationPendingDetectionPlan({
    registry,
    ledgerRows,
    ledgerReadModel,
  });
  const lockPlan = buildMigrationExecutionLockPlan({
    databaseConfigured,
    allowAcquire: false,
  });
  const automaticExecutionPlan = buildMigrationAutomaticExecutionPlan({
    explicitApproval: executionGuard.executionAllowed === true,
    decision: executionDecision,
    guard: executionGuard,
    lockPlan,
    pendingPlan: pendingDetection,
    registry,
    databaseConfigured,
    lockAcquired: false,
  });

  const dbConfigured = Boolean(databaseConfigured);
  const registryOk = registryValidation.ok === true;
  const transactionBoundaryAvailable = hasTransactionBoundary(transactionBoundary);
  const executionStillBlocked = automaticExecutionPlan.ready === false;

  let reason = MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.READY_FOR_REVIEW;

  if (!registryOk) {
    reason = MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.REGISTRY_INVALID;
  } else if (!dbConfigured) {
    reason = MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.DATABASE_NOT_CONFIGURED;
  } else if (!transactionBoundaryAvailable) {
    reason = MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.TRANSACTION_BOUNDARY_MISSING;
  } else if (executionStillBlocked) {
    reason = MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.EXECUTION_STILL_BLOCKED;
  }

  return {
    ok: registryOk && dbConfigured && transactionBoundaryAvailable && executionStillBlocked,
    type: "automatic_migration_execution_preflight",
    version: MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_VERSION,
    mode: "read_only_automatic_preflight",
    reason,
    summary: "Automatic migration execution preflight completed without acquiring locks, opening transactions, executing SQL, or mutating the database.",
    willMutateDatabase: false,
    database: {
      configured: dbConfigured,
      checked: true,
      secretExposed: false,
    },
    runtimeGates: {
      current: runtimeConfig.gates || {},
      simulatedForReadiness: Boolean(simulateApprovedGates),
      simulationAllowedToExecute: false,
    },
    transaction: {
      boundaryAvailable: transactionBoundaryAvailable,
      opened: false,
      committed: false,
      rolledBack: false,
    },
    lock: {
      planReady: lockPlan.ok === true,
      lockKey: lockPlan.lockKey,
      acquireAllowed: false,
      acquireAttempted: false,
      acquired: false,
    },
    pendingDetection: {
      ok: pendingDetection.ok,
      pendingKnown: pendingDetection.pendingKnown,
      pendingCount: pendingDetection.pendingCount,
      pendingMigrations: pendingDetection.pendingMigrations,
      willMutateDatabase: pendingDetection.willMutateDatabase,
    },
    execution: {
      attempted: false,
      decision: executionDecision.decision,
      decisionReason: executionDecision.reason,
      guardAllowed: executionGuard.executionAllowed === true,
      planReady: automaticExecutionPlan.ready,
      planReason: automaticExecutionPlan.reason,
      stillBlocked: executionStillBlocked,
      willMutateDatabase: false,
    },
    ledger: {
      planReady: ledgerPlan.ok === true,
      tableName: ledgerPlan.tableName,
      sqlCount: ledgerPlan.sqlCount,
      writeAttempted: false,
      willMutateDatabase: false,
    },
    observationAfterExecution: {
      required: true,
      executionReportAvailableNow: false,
      reason: "observation_after_execution_requires_a_separate_future_execution_event",
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
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_VERSION,
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS,
  buildAutomaticMigrationExecutionPreflight,
};
