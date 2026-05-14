// SG 2.0 migration runtime hook skeleton.
// Purpose: provide a startup-safe hook boundary for future automatic migrations.
// This module must not execute migrations, mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

import { buildMigrationAutomaticOrchestrationPlan } from "../db/migrations/migrationAutomaticOrchestrator.js";

export const MIGRATION_RUNTIME_HOOK_VERSION = 1;

export function startMigrationRuntimeHook(options = {}) {
  const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan(options);

  return {
    ok: true,
    type: "migration_runtime_hook",
    version: MIGRATION_RUNTIME_HOOK_VERSION,
    mode: "startup_safe_skeleton",
    started: false,
    installed: true,
    executionAttempted: false,
    willMutateDatabase: false,
    reason: "migration_runtime_hook_skeleton_installed_without_execution",
    orchestrationPlan,
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      envGateRequiredBeforeFutureExecution: true,
    },
    stop() {
      return {
        ok: true,
        stopped: false,
        reason: "migration_runtime_hook_no_active_worker",
      };
    },
  };
}

export default {
  MIGRATION_RUNTIME_HOOK_VERSION,
  startMigrationRuntimeHook,
};
