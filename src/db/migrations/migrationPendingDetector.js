// SG 2.0 migration pending detector skeleton.
// Purpose: identify registered migrations and compare them with read-only ledger state.
// This module must not mutate DB, open transactions, execute migrations, call AI, touch Telegram, or write Project Memory.

import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";
import { buildMigrationLedgerReadModel } from "./migrationLedgerReader.js";

export const MIGRATION_PENDING_DETECTOR_VERSION = 2;

function summarizeMigrations(migrations = []) {
  return migrations.map((migration) => ({
    id: migration?.id || null,
    name: migration?.name || null,
    module: migration?.module || "core",
    sqlCount: Array.isArray(migration?.upSql) ? migration.upSql.length : 0,
  }));
}

function buildAppliedMigrationIdSet({ ledgerReadModel } = {}) {
  return new Set(
    Array.isArray(ledgerReadModel?.appliedIds)
      ? ledgerReadModel.appliedIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  );
}

export function detectPendingMigrations({ migrations = [], ledgerReadModel } = {}) {
  const appliedIds = buildAppliedMigrationIdSet({ ledgerReadModel });

  return migrations.filter((migration) => {
    const id = String(migration?.id || "").trim();
    return id && !appliedIds.has(id);
  });
}

export function buildMigrationPendingDetectionPlan({
  registry,
  ledgerRows = [],
  ledgerReadModel = null,
  liveReadAttempted = false,
  tableName,
} = {}) {
  const validation = validateMigrationRegistry({ registry });
  const migrations = getRegisteredMigrations({ registry });
  const resolvedLedgerReadModel = ledgerReadModel || buildMigrationLedgerReadModel({
    tableName,
    rows: ledgerRows,
    liveReadAttempted,
  });
  const pendingMigrations = validation.ok === true
    ? detectPendingMigrations({ migrations, ledgerReadModel: resolvedLedgerReadModel })
    : [];

  return {
    ok: validation.ok === true && resolvedLedgerReadModel.ok === true,
    type: "migration_pending_detection_plan",
    version: MIGRATION_PENDING_DETECTOR_VERSION,
    mode: "db_backed_read_only_comparison",
    implemented: true,
    reason: "pending_detection_uses_registry_and_read_only_ledger_model",
    migrationCount: migrations.length,
    pendingKnown: true,
    pendingCount: pendingMigrations.length,
    pendingMigrations: summarizeMigrations(pendingMigrations),
    registeredMigrations: summarizeMigrations(migrations),
    ledger: {
      ok: resolvedLedgerReadModel.ok,
      tableName: resolvedLedgerReadModel.tableName,
      appliedKnown: resolvedLedgerReadModel.appliedKnown,
      appliedCount: resolvedLedgerReadModel.appliedCount,
      liveReadAttempted: resolvedLedgerReadModel.liveReadAttempted,
      selectOnly: resolvedLedgerReadModel.safety?.selectOnly === true,
    },
    validation,
    willMutateDatabase: false,
    safety: {
      readOnlyLedgerComparison: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlWriteExecution: true,
      noMigrationExecution: true,
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
  MIGRATION_PENDING_DETECTOR_VERSION,
  detectPendingMigrations,
  buildMigrationPendingDetectionPlan,
};
