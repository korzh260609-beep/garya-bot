// scripts/smokeMigrationExecutionGuardSkeleton.js
// SG 2.0 smoke test for migration execution guard skeleton.
// Purpose: prove migration execution remains blocked and non-mutating in this stage.

import assert from "node:assert/strict";

import {
  MIGRATION_EXECUTION_GUARD_REASON,
  assertMigrationExecutionBlocked,
  buildMigrationExecutionGuard,
} from "../src/db/migrations/migrationExecutionGuard.js";
import { MIGRATION_RUNTIME_ENV } from "../src/db/migrations/migrationRuntimeConfig.js";

assert.equal(MIGRATION_EXECUTION_GUARD_REASON, "migration_execution_requires_explicit_future_approval");
assert.equal(MIGRATION_RUNTIME_ENV.RUN_MIGRATIONS_ON_BOOT, "RUN_MIGRATIONS_ON_BOOT");

const originalRunMigrationsOnBoot = process.env.RUN_MIGRATIONS_ON_BOOT;

delete process.env.RUN_MIGRATIONS_ON_BOOT;
const guard = buildMigrationExecutionGuard();

assert.equal(guard.ok, true);
assert.equal(guard.type, "migration_execution_guard");
assert.equal(guard.executionAllowed, false);
assert.equal(guard.reason, "migration_execution_requires_explicit_future_approval");
assert.equal(guard.willMutateDatabase, false);
assert.equal(guard.env.runMigrationsOnBoot, false);
assert.equal(guard.env.runMigrationsOnBootEnvKey, "RUN_MIGRATIONS_ON_BOOT");
assert.equal(guard.env.existingEnvVariableUsed, true);
assert.equal(guard.rules.noDefaultExecution, true);
assert.equal(guard.rules.noQueryExecution, true);
assert.equal(guard.rules.noStartupExecution, true);
assert.equal(guard.rules.noTelegramExecution, true);
assert.equal(guard.rules.noAiExecution, true);
assert.equal(guard.rules.noProjectMemoryWrite, true);
assert.equal(guard.rules.explicitApprovalRequired, true);
assert.equal(guard.rules.envFlagAloneDoesNotBypassGuard, true);

process.env.RUN_MIGRATIONS_ON_BOOT = "1";
const enabledEnvGuard = buildMigrationExecutionGuard();

assert.equal(enabledEnvGuard.env.runMigrationsOnBoot, true);
assert.equal(enabledEnvGuard.executionAllowed, false);
assert.equal(enabledEnvGuard.willMutateDatabase, false);
assert.equal(enabledEnvGuard.rules.envFlagAloneDoesNotBypassGuard, true);

if (originalRunMigrationsOnBoot === undefined) {
  delete process.env.RUN_MIGRATIONS_ON_BOOT;
} else {
  process.env.RUN_MIGRATIONS_ON_BOOT = originalRunMigrationsOnBoot;
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

console.log("OK: migration execution guard recognizes RUN_MIGRATIONS_ON_BOOT and remains non-mutating");
