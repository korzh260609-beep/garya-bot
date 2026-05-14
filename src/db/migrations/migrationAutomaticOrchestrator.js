// SG 2.0 automatic migration orchestration skeleton.
// Purpose: compose future automatic migration execution checks without executing migrations yet.
// This module must not mutate DB, open transactions, run SQL, call AI, touch Telegram, or write Project Memory.

import { buildMigrationDbReadinessPlan } from "./migrationAutomaticReadinessPlan.js";
import { buildMigrationExecutionDecision } from "./migrationExecutionController.js";
import { buildMigrationExecutionGuard } from "./migrationExecutionGuard.js";
import { buildMigrationExecutionLockPlan } from "./migrationExecutionLock.js";
import { buildMigrationPendingDetectionPlan } from "./migrationPendingDetector.js";

export const MIGRATION_AUTOMATIC_ORCHESTRATOR_VERSION = 1;

export function buildMigrationAutomaticOrchestrationPlan(options = {}) {
  const guard = options.guard || buildMigrationExecutionGuard(options);
  const decision = options.decision || buildMigrationExecutionDecision({
    ...options,
    guard,
  });
  const lockPlan = options.lockPlan || buildMigrationExecutionLockPlan(options);
  const pendingPlan = options.pendingPlan || buildMigrationPendingDetectionPlan(options);
  const dbReadinessPlan = options.dbReadinessPlan || buildMigrationDbReadinessPlan(options);

  const autoExecutionEnabled = decision?.decision === "ready_for_future_execution";
  const executionBlocked = true;

  return {
    ok: true,
    type: "migration_automatic_orchestration_plan",
    version: MIGRATION_AUTOMATIC_ORCHESTRATOR_VERSION,
    mode: "automatic_orchestration_skeleton",
    implemented: false,
    autoExecutionEnabled,
    executionBlocked,
    reason: "automatic_migration_execution_not_implemented_yet",
    willMutateDatabase: false,
    decision,
    guard,
    lockPlan,
    pendingPlan,
    dbReadinessPlan,
    startupHook: {
      planned: true,
      installed: false,
      enabledByDefault: false,
      requiresEnvGate: true,
    },
    report: {
      observationPlanned: true,
      observationWritten: false,
      runtimeStatusPlanned: true,
    },
    safety: {
      noDbMutation: true,
      noTransactionOpened: true,
      noSqlExecution: true,
      noMigrationExecution: true,
      noLedgerWrite: true,
      noSchemaCreation: true,
      noStartupExecution: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
      envGateRequired: true,
      lockRequiredBeforeFutureExecution: true,
      pendingDetectionRequiredBeforeFutureExecution: true,
      observationReportRequiredAfterFutureExecution: true,
    },
  };
}

export default {
  MIGRATION_AUTOMATIC_ORCHESTRATOR_VERSION,
  buildMigrationAutomaticOrchestrationPlan,
};
