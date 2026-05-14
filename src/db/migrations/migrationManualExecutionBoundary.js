// AGENT NOTE:
// SG 2.0 manual migration execution boundary skeleton.
// Purpose: provide one explicit callable boundary that composes decision, registry, and transaction orchestration.
// Do not import postgresClient, add startup hooks, read env directly, call AI, touch Telegram, or write Project Memory here.

import { MIGRATION_EXECUTION_DECISIONS } from "./migrationExecutionController.js";
import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";
import { runMigrationTransaction } from "./migrationTransactionOrchestrator.js";

export const MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION = 1;

export const MIGRATION_MANUAL_EXECUTION_REASONS = Object.freeze({
  DECISION_NOT_READY: "manual_migration_decision_not_ready",
  TRANSACTION_BOUNDARY_REQUIRED: "manual_migration_transaction_boundary_required",
  REGISTRY_INVALID: "manual_migration_registry_invalid",
  NO_MIGRATIONS: "manual_migration_registry_empty",
});

function hasTransactionBoundary(withTransaction) {
  return typeof withTransaction === "function";
}

function normalizeMigrationResults(results = []) {
  const applied = results.filter((result) => result?.status === "applied").length;
  const skipped = results.filter((result) => result?.status === "skipped").length;
  const failed = results.filter((result) => result?.status === "failed" || result?.ok === false).length;

  return {
    total: results.length,
    applied,
    skipped,
    failed,
  };
}

export function canRunManualMigrationExecution({
  decision,
  withTransaction,
  registry,
} = {}) {
  const validation = validateMigrationRegistry({ registry });
  const migrations = getRegisteredMigrations({ registry });

  if (decision?.decision !== MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION) {
    return {
      ok: false,
      reason: MIGRATION_MANUAL_EXECUTION_REASONS.DECISION_NOT_READY,
      migrationCount: migrations.length,
      validation,
    };
  }

  if (!hasTransactionBoundary(withTransaction)) {
    return {
      ok: false,
      reason: MIGRATION_MANUAL_EXECUTION_REASONS.TRANSACTION_BOUNDARY_REQUIRED,
      migrationCount: migrations.length,
      validation,
    };
  }

  if (!validation.ok) {
    return {
      ok: false,
      reason: MIGRATION_MANUAL_EXECUTION_REASONS.REGISTRY_INVALID,
      migrationCount: migrations.length,
      validation,
    };
  }

  if (migrations.length === 0) {
    return {
      ok: false,
      reason: MIGRATION_MANUAL_EXECUTION_REASONS.NO_MIGRATIONS,
      migrationCount: migrations.length,
      validation,
    };
  }

  return {
    ok: true,
    reason: "manual_migration_execution_allowed",
    migrationCount: migrations.length,
    validation,
  };
}

export async function runManualMigrationExecution({
  decision,
  withTransaction,
  registry,
} = {}) {
  const validation = validateMigrationRegistry({ registry });
  const migrations = getRegisteredMigrations({ registry });
  const allowed = canRunManualMigrationExecution({
    decision,
    withTransaction,
    registry,
  });

  if (!allowed.ok) {
    return {
      ok: false,
      type: "manual_migration_execution_result",
      version: MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION,
      status: "skipped",
      reason: allowed.reason,
      mode: "manual_callable_boundary",
      migrationCount: migrations.length,
      willMutateDatabase: false,
      validation,
      results: [],
      summary: normalizeMigrationResults([]),
      rules: {
        noStartupExecution: true,
        noEnvRead: true,
        noDirectPostgresImport: true,
        noTelegramExecution: true,
        noAiExecution: true,
        noProjectMemoryWrite: true,
        injectedDecisionRequired: true,
        injectedTransactionBoundaryRequired: true,
      },
    };
  }

  const results = [];

  for (const migration of migrations) {
    const result = await runMigrationTransaction({
      decision,
      withTransaction,
      migration,
    });

    results.push(result);

    if (!result.ok) {
      break;
    }
  }

  const summary = normalizeMigrationResults(results);

  return {
    ok: summary.failed === 0,
    type: "manual_migration_execution_result",
    version: MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION,
    status: summary.failed === 0 ? "completed" : "failed",
    reason: summary.failed === 0
      ? "manual_migration_execution_completed"
      : "manual_migration_execution_failed",
    mode: "manual_callable_boundary",
    migrationCount: migrations.length,
    willMutateDatabase: true,
    validation,
    results,
    summary,
    rules: {
      noStartupExecution: true,
      noEnvRead: true,
      noDirectPostgresImport: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      injectedDecisionRequired: true,
      injectedTransactionBoundaryRequired: true,
    },
  };
}

export default {
  MIGRATION_MANUAL_EXECUTION_BOUNDARY_VERSION,
  MIGRATION_MANUAL_EXECUTION_REASONS,
  canRunManualMigrationExecution,
  runManualMigrationExecution,
};
