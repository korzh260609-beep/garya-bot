// AGENT NOTE:
// SG 2.0 automatic migration executor boundary.
// Purpose: coordinate future automatic migration execution behind explicit env and approval gates.
// This module must not be imported by startup hooks as an execution trigger without a separate approved PR.
// Do not call AI, touch Telegram, write Project Memory, or bypass the execution guard here.

import { withPostgresTransaction } from "../postgresClient.js";
import { MIGRATION_EXECUTION_DECISIONS, buildMigrationExecutionDecision } from "./migrationExecutionController.js";
import { buildMigrationExecutionGuard } from "./migrationExecutionGuard.js";
import { buildMigrationExecutionLockPlan } from "./migrationExecutionLock.js";
import { buildMigrationPendingDetectionPlan } from "./migrationPendingDetector.js";
import { getRegisteredMigrations } from "./migrationRegistry.js";
import { runMigrationTransaction } from "./migrationTransactionOrchestrator.js";

export const MIGRATION_AUTOMATIC_EXECUTOR_VERSION = 1;

export const MIGRATION_AUTOMATIC_EXECUTOR_REASONS = Object.freeze({
  APPROVAL_REQUIRED: "migration_automatic_execution_explicit_approval_required",
  ENV_GATE_DISABLED: "migration_automatic_execution_env_gate_disabled",
  GUARD_BLOCKED: "migration_automatic_execution_guard_blocked",
  DATABASE_NOT_CONFIGURED: "migration_automatic_execution_database_not_configured",
  LOCK_NOT_ACQUIRED: "migration_automatic_execution_lock_not_acquired",
  NO_PENDING_MIGRATIONS: "migration_automatic_execution_no_pending_migrations",
  READY: "migration_automatic_execution_ready",
});

function isEnvGateEnabled(decision) {
  return Boolean(decision?.runtimeConfig?.env?.runMigrationsOnBoot?.enabled);
}

function isExplicitlyApproved(options = {}) {
  return options.explicitApproval === true;
}

function summarizeMigration(migration = {}) {
  return {
    id: migration?.id || null,
    name: migration?.name || null,
    module: migration?.module || "core",
    sqlCount: Array.isArray(migration?.upSql) ? migration.upSql.length : 0,
  };
}

export function buildMigrationAutomaticExecutionPlan({
  explicitApproval = false,
  decision = null,
  guard = null,
  lockPlan = null,
  pendingPlan = null,
  registry,
  databaseConfigured = false,
  lockAcquired = false,
} = {}) {
  const resolvedGuard = guard || buildMigrationExecutionGuard();
  const resolvedDecision = decision || buildMigrationExecutionDecision({
    guard: resolvedGuard,
    databaseConfigured,
  });
  const resolvedLockPlan = lockPlan || buildMigrationExecutionLockPlan({ databaseConfigured });
  const resolvedPendingPlan = pendingPlan || buildMigrationPendingDetectionPlan({ registry });
  const migrations = getRegisteredMigrations({ registry });
  const pendingIds = new Set(
    Array.isArray(resolvedPendingPlan?.pendingMigrations)
      ? resolvedPendingPlan.pendingMigrations.map((migration) => migration?.id).filter(Boolean)
      : [],
  );
  const pendingMigrations = migrations.filter((migration) => pendingIds.has(migration.id));

  let ready = true;
  let reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.READY;

  if (!isExplicitlyApproved({ explicitApproval })) {
    ready = false;
    reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.APPROVAL_REQUIRED;
  } else if (!isEnvGateEnabled(resolvedDecision)) {
    ready = false;
    reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.ENV_GATE_DISABLED;
  } else if (resolvedGuard?.executionAllowed !== true) {
    ready = false;
    reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.GUARD_BLOCKED;
  } else if (resolvedDecision?.decision !== MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION) {
    ready = false;
    reason = resolvedDecision?.reason || MIGRATION_AUTOMATIC_EXECUTOR_REASONS.DATABASE_NOT_CONFIGURED;
  } else if (!lockAcquired) {
    ready = false;
    reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.LOCK_NOT_ACQUIRED;
  } else if (pendingMigrations.length === 0) {
    ready = false;
    reason = MIGRATION_AUTOMATIC_EXECUTOR_REASONS.NO_PENDING_MIGRATIONS;
  }

  return {
    ok: true,
    type: "migration_automatic_execution_plan",
    version: MIGRATION_AUTOMATIC_EXECUTOR_VERSION,
    mode: "automatic_execution_boundary",
    ready,
    reason,
    explicitApproval: Boolean(explicitApproval),
    envGateEnabled: isEnvGateEnabled(resolvedDecision),
    guardExecutionAllowed: resolvedGuard?.executionAllowed === true,
    databaseConfigured: Boolean(databaseConfigured),
    lockRequired: true,
    lockAcquired: Boolean(lockAcquired),
    pendingKnown: resolvedPendingPlan?.pendingKnown === true,
    pendingCount: pendingMigrations.length,
    pendingMigrations: pendingMigrations.map(summarizeMigration),
    decision: resolvedDecision,
    guard: resolvedGuard,
    lockPlan: resolvedLockPlan,
    pendingPlan: resolvedPendingPlan,
    willMutateDatabase: ready,
    safety: {
      noDefaultExecution: true,
      explicitApprovalRequired: true,
      envGateRequired: true,
      guardMustAllowExecution: true,
      dbLockMustBeAcquired: true,
      transactionRequired: true,
      ledgerRequired: true,
      noStartupHookConnection: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export async function runMigrationAutomaticExecution({
  explicitApproval = false,
  decision = null,
  guard = null,
  lockAcquired = false,
  registry,
  databaseConfigured = false,
  withTransaction = withPostgresTransaction,
} = {}) {
  const plan = buildMigrationAutomaticExecutionPlan({
    explicitApproval,
    decision,
    guard,
    lockAcquired,
    registry,
    databaseConfigured,
  });

  if (!plan.ready) {
    return {
      ok: false,
      type: "migration_automatic_execution_result",
      status: "skipped",
      reason: plan.reason,
      plan,
      results: [],
      appliedCount: 0,
      failedCount: 0,
      willMutateDatabase: false,
    };
  }

  const results = [];

  for (const migrationSummary of plan.pendingMigrations) {
    const migration = getRegisteredMigrations({ registry }).find((item) => item.id === migrationSummary.id);
    const result = await runMigrationTransaction({
      decision: plan.decision,
      withTransaction,
      migration,
    });
    results.push(result);

    if (!result.ok) {
      break;
    }
  }

  const failedCount = results.filter((result) => result?.ok !== true).length;
  const appliedCount = results.filter((result) => result?.status === "applied").length;

  return {
    ok: failedCount === 0,
    type: "migration_automatic_execution_result",
    status: failedCount === 0 ? "completed" : "failed",
    reason: failedCount === 0 ? "migration_automatic_execution_completed" : "migration_automatic_execution_failed",
    plan,
    results,
    appliedCount,
    failedCount,
    willMutateDatabase: true,
  };
}

export default {
  MIGRATION_AUTOMATIC_EXECUTOR_VERSION,
  MIGRATION_AUTOMATIC_EXECUTOR_REASONS,
  buildMigrationAutomaticExecutionPlan,
  runMigrationAutomaticExecution,
};
