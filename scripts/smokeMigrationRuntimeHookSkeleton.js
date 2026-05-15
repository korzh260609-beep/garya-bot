// scripts/smokeMigrationRuntimeHookSkeleton.js
// SG 2.0 smoke test for automatic migration runtime hook.

import assert from "node:assert/strict";

import { startMigrationRuntimeHook } from "../src/app/migrationRuntimeHook.js";
import { startRuntimeHooks } from "../src/app/runtimeHooks.js";

const hook = startMigrationRuntimeHook({
  databaseConfigured: true,
});

assert.equal(hook.ok, true);
assert.equal(hook.type, "migration_runtime_hook");
assert.equal(hook.mode, "runtime_locked_execution_gate");
assert.equal(hook.started, false);
assert.equal(hook.installed, true);
assert.equal(hook.executionAttempted, false);
assert.equal(hook.willMutateDatabase, false);
assert.equal(hook.executionPromise, null);
assert.equal(hook.orchestrationPlan.type, "migration_automatic_orchestration_plan");
assert.equal(hook.orchestrationPlan.implemented, true);
assert.equal(hook.orchestrationPlan.executionBlocked, true);
assert.equal(hook.orchestrationPlan.willMutateDatabase, false);
assert.equal(hook.orchestrationPlan.visibility.dbBackedLockBoundaryReady, true);
assert.equal(hook.orchestrationPlan.visibility.pendingDetectionImplemented, true);
assert.equal(hook.lockedExecutionPlan.ok, true);
assert.equal(hook.lockedExecutionPlan.mode, "runtime_locked_execution_gate");
assert.equal(hook.lockedExecutionPlan.executionBoundaryAvailable, true);
assert.equal(hook.lockedExecutionPlan.executionAllowed, false);
assert.equal(hook.lockedExecutionPlan.executionAttempted, false);
assert.equal(hook.lockedExecutionPlan.executionSkipped, true);
assert.equal(hook.lockedExecutionPlan.willMutateDatabase, false);
assert.equal(hook.lockedExecutionPlan.safety.noExecutionWhenGatesDisabled, true);
assert.equal(hook.safety.noExecutionWhenGatesDisabled, true);
assert.equal(hook.safety.automaticExecutionRequiresTwoEnvGates, true);
assert.equal(hook.safety.noTelegramExecution, true);
assert.equal(hook.safety.noAiExecution, true);
assert.equal(hook.safety.noProjectMemoryWrite, true);

const hookStop = hook.stop();
assert.equal(hookStop.ok, true);
assert.equal(hookStop.stopped, false);
assert.equal(hookStop.reason, "migration_runtime_hook_no_active_worker");

let fakeRunnerCalls = 0;
const gatedHook = startMigrationRuntimeHook({
  databaseConfigured: true,
  runtimeConfig: {
    ok: true,
    type: "migration_runtime_config",
    env: {
      runMigrationsOnBoot: { key: "RUN_MIGRATIONS_ON_BOOT", configured: true, enabled: true },
      approveMigrationsOnBoot: { key: "APPROVE_MIGRATIONS_ON_BOOT", configured: true, enabled: true },
    },
    gates: {
      automaticExecutionRequested: true,
      automaticExecutionApproved: true,
      automaticExecutionAllowed: true,
    },
  },
  runLockedExecution: async () => {
    fakeRunnerCalls += 1;
    return {
      ok: true,
      type: "migration_automatic_locked_execution_result",
      status: "completed",
      willMutateDatabase: true,
    };
  },
});

assert.equal(gatedHook.ok, true);
assert.equal(gatedHook.started, true);
assert.equal(gatedHook.executionAttempted, true);
assert.equal(gatedHook.willMutateDatabase, true);
assert.equal(gatedHook.lockedExecutionPlan.executionAllowed, true);
assert.equal(gatedHook.lockedExecutionPlan.executionAttempted, true);
assert.equal(gatedHook.lockedExecutionPlan.executionSkipped, false);
assert.equal(gatedHook.lockedExecutionPlan.willMutateDatabase, true);
assert.equal(typeof gatedHook.executionPromise?.then, "function");

const gatedResult = await gatedHook.executionPromise;
assert.equal(fakeRunnerCalls, 1);
assert.equal(gatedResult.ok, true);
assert.equal(gatedResult.status, "completed");

let throwingRunnerCalls = 0;
const throwingHook = startMigrationRuntimeHook({
  databaseConfigured: true,
  runtimeConfig: {
    ok: true,
    type: "migration_runtime_config",
    env: {
      runMigrationsOnBoot: { key: "RUN_MIGRATIONS_ON_BOOT", configured: true, enabled: true },
      approveMigrationsOnBoot: { key: "APPROVE_MIGRATIONS_ON_BOOT", configured: true, enabled: true },
    },
    gates: {
      automaticExecutionRequested: true,
      automaticExecutionApproved: true,
      automaticExecutionAllowed: true,
    },
  },
  runLockedExecution: () => {
    throwingRunnerCalls += 1;
    throw new Error("sync_runner_failure");
  },
});

assert.equal(throwingHook.ok, true);
assert.equal(throwingHook.started, true);
assert.equal(throwingHook.executionAttempted, true);
assert.equal(throwingHook.willMutateDatabase, true);
assert.equal(typeof throwingHook.executionPromise?.then, "function");

const throwingResult = await throwingHook.executionPromise;
assert.equal(throwingRunnerCalls, 1);
assert.equal(throwingResult.ok, false);
assert.equal(throwingResult.type, "migration_runtime_locked_execution_error");
assert.equal(throwingResult.reason, "sync_runner_failure");
assert.equal(throwingResult.error.name, "Error");
assert.equal(throwingResult.error.message, "sync_runner_failure");
assert.equal(throwingResult.willMutateDatabase, false);

const runtimeHooks = startRuntimeHooks();
assert.equal(runtimeHooks.ok, true);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.ok, true);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.executionAttempted, false);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.willMutateDatabase, false);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.safety.noExecutionWhenGatesDisabled, true);

const runtimeStop = runtimeHooks.stop();
assert.equal(runtimeStop.ok, true);
assert.equal(runtimeStop.stopped, false);
assert.equal(runtimeStop.hooks.migrationRuntimeHook.ok, true);
assert.equal(runtimeStop.hooks.migrationRuntimeHook.stopped, false);

console.log("OK: migration runtime hook runs locked executor only when both gates are active and captures sync runner errors");
