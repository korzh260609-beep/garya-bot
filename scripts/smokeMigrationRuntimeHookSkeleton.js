// scripts/smokeMigrationRuntimeHookSkeleton.js
// SG 2.0 smoke test for automatic migration runtime hook skeleton.

import assert from "node:assert/strict";

import { startMigrationRuntimeHook } from "../src/app/migrationRuntimeHook.js";
import { startRuntimeHooks } from "../src/app/runtimeHooks.js";

const hook = startMigrationRuntimeHook({
  databaseConfigured: true,
});

assert.equal(hook.ok, true);
assert.equal(hook.type, "migration_runtime_hook");
assert.equal(hook.mode, "startup_safe_skeleton");
assert.equal(hook.started, false);
assert.equal(hook.installed, true);
assert.equal(hook.executionAttempted, false);
assert.equal(hook.willMutateDatabase, false);
assert.equal(hook.orchestrationPlan.type, "migration_automatic_orchestration_plan");
assert.equal(hook.orchestrationPlan.implemented, true);
assert.equal(hook.orchestrationPlan.executionBlocked, true);
assert.equal(hook.orchestrationPlan.willMutateDatabase, false);
assert.equal(hook.orchestrationPlan.visibility.dbBackedLockBoundaryReady, true);
assert.equal(hook.orchestrationPlan.visibility.pendingDetectionImplemented, true);
assert.equal(hook.safety.noDbMutation, true);
assert.equal(hook.safety.noTransactionOpened, true);
assert.equal(hook.safety.noSqlExecution, true);
assert.equal(hook.safety.noMigrationExecution, true);
assert.equal(hook.safety.noLedgerWrite, true);
assert.equal(hook.safety.noSchemaCreation, true);
assert.equal(hook.safety.noTelegramExecution, true);
assert.equal(hook.safety.noAiExecution, true);
assert.equal(hook.safety.noProjectMemoryWrite, true);

const hookStop = hook.stop();
assert.equal(hookStop.ok, true);
assert.equal(hookStop.stopped, false);
assert.equal(hookStop.reason, "migration_runtime_hook_no_active_worker");

const runtimeHooks = startRuntimeHooks();
assert.equal(runtimeHooks.ok, true);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.ok, true);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.executionAttempted, false);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.willMutateDatabase, false);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.safety.noMigrationExecution, true);
assert.equal(runtimeHooks.hooks.migrationRuntimeHook.safety.noDbMutation, true);

const runtimeStop = runtimeHooks.stop();
assert.equal(runtimeStop.ok, true);
assert.equal(runtimeStop.stopped, false);
assert.equal(runtimeStop.hooks.migrationRuntimeHook.ok, true);
assert.equal(runtimeStop.hooks.migrationRuntimeHook.stopped, false);

console.log("OK: migration runtime hook skeleton is installed but non-executing");
