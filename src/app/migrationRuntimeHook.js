// SG 2.0 migration runtime hook skeleton.
// Purpose: provide a startup-safe hook boundary for future automatic migrations.
// This module must not execute migrations, mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

import { buildMigrationAutomaticExecutionPlan } from "../db/migrations/migrationAutomaticExecutor.js";
import { buildMigrationAutomaticOrchestrationPlan } from "../db/migrations/migrationAutomaticOrchestrator.js";

export const MIGRATION_RUNTIME_HOOK_VERSION = 2;

function buildLockedExecutionRuntimePlan(options = {}) {
  const executionPlan = buildMigrationAutomaticExecutionPlan({
    ...options,
    explicitApproval: false,
    lockAcquired: false,
  });

  return {
    ok: true,
    type: "migration_runtime_locked_execution_plan",
    version: MIGRATION_RUNTIME_HOOK_VERSION,
    mode: "startup_safe_locked_execution_plan_only",
    installed: true,
    executionBoundaryAvailable: true,
    executionAttempted: false,
    executionSkipped: true,
    reason: "migration_runtime_locked_execution_plan_installed_without_execution",
    executionPlan,
    willMutateDatabase: false,
    safety: {
      planOnly: true,
      lockedExecutionFunctionNotCalled: true,
      explicitApprovalNotGranted: true,
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      runMigrationsOnBootNotEnabledHere: true,
    },
  };
}

export function startMigrationRuntimeHook(options = {}) {
  const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan(options);
  const lockedExecutionPlan = buildLockedExecutionRuntimePlan(options);

  return {
    ok: true,
    type: "migration_runtime_hook",
    version: MIGRATION_RUNTIME_HOOK_VERSION,
    mode: "startup_safe_locked_execution_plan",
    started: false,
    installed: true,
    executionAttempted: false,
    willMutateDatabase: false,
    reason: "migration_runtime_hook_installed_with_locked_execution_plan_without_execution",
    orchestrationPlan,
    lockedExecutionPlan,
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
      explicitApprovalRequiredBeforeFutureExecution: true,
      lockedExecutionFunctionNotCalled: true,
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
