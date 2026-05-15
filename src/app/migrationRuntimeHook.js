// SG 2.0 migration runtime hook.
// Purpose: run automatic migrations only when runtime gates explicitly allow it.
// Default behavior stays non-executing because both env gates are false by default.

import {
  buildMigrationAutomaticExecutionPlan,
  runLockedMigrationAutomaticExecution,
} from "../db/migrations/migrationAutomaticExecutor.js";
import { buildMigrationAutomaticOrchestrationPlan } from "../db/migrations/migrationAutomaticOrchestrator.js";
import { buildMigrationExecutionDecision } from "../db/migrations/migrationExecutionController.js";
import { buildMigrationExecutionGuard } from "../db/migrations/migrationExecutionGuard.js";
import { getMigrationRuntimeConfigFromEnv } from "../db/migrations/migrationRuntimeConfig.js";

export const MIGRATION_RUNTIME_HOOK_VERSION = 3;

function shouldRunLockedExecution({ runtimeConfig, decision, guard } = {}) {
  return Boolean(
    runtimeConfig?.gates?.automaticExecutionAllowed === true
    && guard?.executionAllowed === true
    && decision?.decision === "ready_for_future_execution"
  );
}

function buildLockedExecutionRuntimePlan({ runtimeConfig, decision, guard, options = {} } = {}) {
  const executionAllowed = shouldRunLockedExecution({ runtimeConfig, decision, guard });
  const executionPlan = buildMigrationAutomaticExecutionPlan({
    ...options,
    explicitApproval: executionAllowed,
    decision,
    guard,
    lockAcquired: false,
  });

  return {
    ok: true,
    type: "migration_runtime_locked_execution_plan",
    version: MIGRATION_RUNTIME_HOOK_VERSION,
    mode: "runtime_locked_execution_gate",
    installed: true,
    executionBoundaryAvailable: true,
    executionAllowed,
    executionAttempted: false,
    executionSkipped: !executionAllowed,
    reason: executionAllowed
      ? "migration_runtime_locked_execution_allowed_by_gates"
      : "migration_runtime_locked_execution_skipped_by_gates",
    executionPlan,
    willMutateDatabase: false,
    safety: {
      automaticExecutionRequiresTwoEnvGates: true,
      runGateRequired: true,
      approvalGateRequired: true,
      noExecutionWhenGatesDisabled: !executionAllowed,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
    },
  };
}

export function startMigrationRuntimeHook(options = {}) {
  const runtimeConfig = options.runtimeConfig || getMigrationRuntimeConfigFromEnv();
  const guard = options.guard || buildMigrationExecutionGuard({ runtimeConfig });
  const decision = options.decision || buildMigrationExecutionDecision({
    ...options,
    runtimeConfig,
    guard,
  });
  const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan({
    ...options,
    guard,
    decision,
  });
  const lockedExecutionPlan = buildLockedExecutionRuntimePlan({
    runtimeConfig,
    decision,
    guard,
    options,
  });
  const runLockedExecution = options.runLockedExecution || runLockedMigrationAutomaticExecution;
  let executionPromise = null;
  let executionAttempted = false;

  if (lockedExecutionPlan.executionAllowed) {
    executionAttempted = true;
    executionPromise = Promise.resolve(runLockedExecution({
      ...options,
      explicitApproval: true,
      decision,
      guard,
    })).catch((error) => ({
      ok: false,
      type: "migration_runtime_locked_execution_error",
      reason: error?.message || "migration_runtime_locked_execution_failed",
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error || "unknown_error"),
      },
      willMutateDatabase: false,
    }));
  }

  return {
    ok: true,
    type: "migration_runtime_hook",
    version: MIGRATION_RUNTIME_HOOK_VERSION,
    mode: "runtime_locked_execution_gate",
    started: executionAttempted,
    installed: true,
    executionAttempted,
    willMutateDatabase: executionAttempted,
    reason: executionAttempted
      ? "migration_runtime_hook_started_locked_execution"
      : "migration_runtime_hook_skipped_locked_execution",
    runtimeConfig,
    guard,
    decision,
    orchestrationPlan,
    lockedExecutionPlan: {
      ...lockedExecutionPlan,
      executionAttempted,
      executionSkipped: !executionAttempted,
      willMutateDatabase: executionAttempted,
    },
    executionPromise,
    safety: {
      noExecutionWhenGatesDisabled: !executionAttempted,
      automaticExecutionRequiresTwoEnvGates: true,
      runGateRequired: true,
      approvalGateRequired: true,
      noTelegramExecution: true,
      noAiExecution: true,
      noProjectMemoryWrite: true,
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
