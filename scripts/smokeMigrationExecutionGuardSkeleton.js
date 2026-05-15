// scripts/smokeMigrationExecutionGuardSkeleton.js
// SG 2.0 smoke test for migration execution guard.
// Purpose: prove migration execution remains blocked unless both runtime gates are active.

import assert from "node:assert/strict";

import {
  MIGRATION_EXECUTION_GUARD_REASON,
  assertMigrationExecutionBlocked,
  buildMigrationExecutionGuard,
} from "../src/db/migrations/migrationExecutionGuard.js";
import { MIGRATION_RUNTIME_ENV } from "../src/db/migrations/migrationRuntimeConfig.js";

assert.equal(MIGRATION_EXECUTION_GUARD_REASON, "migration_execution_requires_runtime_gates");
assert.equal(MIGRATION_RUNTIME_ENV.RUN_MIGRATIONS_ON_BOOT, "RUN_MIGRATIONS_ON_BOOT");
assert.equal(MIGRATION_RUNTIME_ENV.APPROVE_MIGRATIONS_ON_BOOT, "APPROVE_MIGRATIONS_ON_BOOT");

const originalRunMigrationsOnBoot = process.env.RUN_MIGRATIONS_ON_BOOT;
const originalApproveMigrationsOnBoot = process.env.APPROVE_MIGRATIONS_ON_BOOT;

delete process.env.RUN_MIGRATIONS_ON_BOOT;
delete process.env.APPROVE_MIGRATIONS_ON_BOOT;
const guard = buildMigrationExecutionGuard();

assert.equal(guard.ok, true);
assert.equal(guard.type, "migration_execution_guard");
assert.equal(guard.executionAllowed, false);
assert.equal(guard.reason, "migration_execution_requires_runtime_gates");
assert.equal(guard.willMutateDatabase, false);
assert.equal(guard.env.runMigrationsOnBoot, false);
assert.equal(guard.env.approveMigrationsOnBoot, false);
assert.equal(guard.env.runMigrationsOnBootEnvKey, "RUN_MIGRATIONS_ON_BOOT");
assert.equal(guard.env.approveMigrationsOnBootEnvKey, "APPROVE_MIGRATIONS_ON_BOOT");
assert.equal(guard.rules.noDefaultExecution, true);
assert.equal(guard.rules.noQueryExecution, true);
assert.equal(guard.rules.noStartupExecution, true);
assert.equal(guard.rules.noTelegramExecution, true);
assert.equal(guard.rules.noAiExecution, true);
assert.equal(guard.rules.noProjectMemoryWrite, true);
assert.equal(guard.rules.runGateRequired, true);
assert.equal(guard.rules.approvalGateRequired, true);
assert.equal(guard.rules.bothGatesRequired, true);

process.env.RUN_MIGRATIONS_ON_BOOT = "1";
delete process.env.APPROVE_MIGRATIONS_ON_BOOT;
const runOnlyGuard = buildMigrationExecutionGuard();

assert.equal(runOnlyGuard.env.runMigrationsOnBoot, true);
assert.equal(runOnlyGuard.env.approveMigrationsOnBoot, false);
assert.equal(runOnlyGuard.executionAllowed, false);
assert.equal(runOnlyGuard.willMutateDatabase, false);

process.env.RUN_MIGRATIONS_ON_BOOT = "1";
process.env.APPROVE_MIGRATIONS_ON_BOOT = "1";
const bothGatesGuard = buildMigrationExecutionGuard();

assert.equal(bothGatesGuard.env.runMigrationsOnBoot, true);
assert.equal(bothGatesGuard.env.approveMigrationsOnBoot, true);
assert.equal(bothGatesGuard.executionAllowed, true);
assert.equal(bothGatesGuard.reason, "migration_execution_runtime_gates_passed");
assert.equal(bothGatesGuard.willMutateDatabase, false);

if (originalRunMigrationsOnBoot === undefined) {
  delete process.env.RUN_MIGRATIONS_ON_BOOT;
} else {
  process.env.RUN_MIGRATIONS_ON_BOOT = originalRunMigrationsOnBoot;
}

if (originalApproveMigrationsOnBoot === undefined) {
  delete process.env.APPROVE_MIGRATIONS_ON_BOOT;
} else {
  process.env.APPROVE_MIGRATIONS_ON_BOOT = originalApproveMigrationsOnBoot;
}

const assertion = assertMigrationExecutionBlocked();

assert.equal(assertion.ok, true);
assert.equal(assertion.type, "migration_execution_block_assertion");
assert.equal(assertion.blocked, true);
assert.equal(assertion.guard.executionAllowed, false);
assert.equal(assertion.guard.willMutateDatabase, false);

const customGuard = buildMigrationExecutionGuard({
  reason: "custom_block_reason",
  rules: {
    customRule: true,
  },
});

assert.equal(customGuard.executionAllowed, false);
assert.equal(customGuard.reason, "custom_block_reason");
assert.equal(customGuard.rules.customRule, true);
assert.equal(customGuard.rules.noQueryExecution, true);

console.log("OK: migration execution guard requires both runtime gates and stays non-mutating");
