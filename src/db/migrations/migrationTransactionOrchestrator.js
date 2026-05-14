// AGENT NOTE:
// SG 2.0 migration transaction orchestration skeleton.
// Purpose: compose execution controller, ledger writer, and SQL executor through injected transaction boundary.
// Do not import postgresClient, add startup hooks, read env directly, call AI, touch Telegram, or write Project Memory here.

import { MIGRATION_EXECUTION_DECISIONS } from "./migrationExecutionController.js";
import { writeMigrationLedgerRecord } from "./migrationLedgerWriter.js";
import { executeMigrationSql } from "./migrationSqlExecutor.js";
import { MIGRATION_STATUSES } from "./migrationTypes.js";

export const MIGRATION_TRANSACTION_ORCHESTRATOR_VERSION = 1;

export const MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS = Object.freeze({
  DECISION_NOT_READY: "migration_transaction_decision_not_ready",
  TRANSACTION_BOUNDARY_REQUIRED: "migration_transaction_boundary_required",
  MIGRATION_INVALID: "migration_transaction_migration_invalid",
});

function hasTransactionBoundary(withTransaction) {
  return typeof withTransaction === "function";
}

function normalizeMigration(migration = {}) {
  return {
    ...migration,
    id: String(migration.id || "").trim(),
    name: String(migration.name || "").trim(),
    module: String(migration.module || "core").trim() || "core",
    upSql: Array.isArray(migration.upSql) ? migration.upSql : [],
  };
}

export function canRunMigrationTransaction({ decision, withTransaction, migration } = {}) {
  const normalizedMigration = normalizeMigration(migration);

  if (decision?.decision !== MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION) {
    return {
      ok: false,
      reason: MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS.DECISION_NOT_READY,
      migrationId: normalizedMigration.id,
    };
  }

  if (!hasTransactionBoundary(withTransaction)) {
    return {
      ok: false,
      reason: MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS.TRANSACTION_BOUNDARY_REQUIRED,
      migrationId: normalizedMigration.id,
    };
  }

  if (!normalizedMigration.id || !normalizedMigration.name) {
    return {
      ok: false,
      reason: MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS.MIGRATION_INVALID,
      migrationId: normalizedMigration.id,
    };
  }

  return {
    ok: true,
    reason: "migration_transaction_allowed",
    migrationId: normalizedMigration.id,
  };
}

export async function runMigrationTransaction({
  decision,
  withTransaction,
  migration,
} = {}) {
  const normalizedMigration = normalizeMigration(migration);
  const allowed = canRunMigrationTransaction({
    decision,
    withTransaction,
    migration: normalizedMigration,
  });

  if (!allowed.ok) {
    return {
      ok: false,
      type: "migration_transaction_result",
      status: "skipped",
      reason: allowed.reason,
      migrationId: normalizedMigration.id,
      migrationName: normalizedMigration.name,
      willMutateDatabase: false,
      ledgerBefore: null,
      sql: null,
      ledgerAfter: null,
    };
  }

  return withTransaction(async (client) => {
    const ledgerBefore = await writeMigrationLedgerRecord({
      decision,
      client,
      migration: normalizedMigration,
      status: MIGRATION_STATUSES.PENDING,
    });

    const sql = await executeMigrationSql({
      decision,
      client,
      migration: normalizedMigration,
    });

    if (!sql.ok) {
      const ledgerAfterFailure = await writeMigrationLedgerRecord({
        decision,
        client,
        migration: normalizedMigration,
        status: MIGRATION_STATUSES.FAILED,
        error: sql.reason,
      });

      return {
        ok: false,
        type: "migration_transaction_result",
        status: "failed",
        reason: sql.reason,
        migrationId: normalizedMigration.id,
        migrationName: normalizedMigration.name,
        willMutateDatabase: true,
        ledgerBefore,
        sql,
        ledgerAfter: ledgerAfterFailure,
      };
    }

    const ledgerAfter = await writeMigrationLedgerRecord({
      decision,
      client,
      migration: normalizedMigration,
      status: MIGRATION_STATUSES.APPLIED,
      appliedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      type: "migration_transaction_result",
      status: "applied",
      reason: "migration_transaction_applied",
      migrationId: normalizedMigration.id,
      migrationName: normalizedMigration.name,
      willMutateDatabase: true,
      ledgerBefore,
      sql,
      ledgerAfter,
    };
  });
}

export default {
  MIGRATION_TRANSACTION_ORCHESTRATOR_VERSION,
  MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS,
  canRunMigrationTransaction,
  runMigrationTransaction,
};
