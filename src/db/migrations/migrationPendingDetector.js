// SG 2.0 migration pending detector skeleton.
// Purpose: identify registered migrations that will later need ledger comparison.
// This module must not query, mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

import { getRegisteredMigrations, validateMigrationRegistry } from "./migrationRegistry.js";

export const MIGRATION_PENDING_DETECTOR_VERSION = 1;

function summarizeMigrations(migrations = []) {
  return migrations.map((migration) => ({
    id: migration?.id || null,
    name: migration?.name || null,
    module: migration?.module || "core",
    sqlCount: Array.isArray(migration?.upSql) ? migration.upSql.length : 0,
  }));
}

export function buildMigrationPendingDetectionPlan({ registry } = {}) {
  const validation = validateMigrationRegistry({ registry });
  const migrations = getRegisteredMigrations({ registry });

  return {
    ok: validation.ok === true,
    type: "migration_pending_detection_plan",
    version: MIGRATION_PENDING_DETECTOR_VERSION,
    mode: "registry_only_plan",
    implemented: false,
    reason: "ledger_comparison_not_implemented_yet",
    migrationCount: migrations.length,
    pendingKnown: false,
    pendingCount: null,
    pendingMigrations: [],
    registeredMigrations: summarizeMigrations(migrations),
    validation,
    willMutateDatabase: false,
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export default {
  MIGRATION_PENDING_DETECTOR_VERSION,
  buildMigrationPendingDetectionPlan,
};
