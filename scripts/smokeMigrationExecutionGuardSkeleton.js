// scripts/smokeMigrationExecutionGuardSkeleton.js
// SG 2.0 smoke test for migration execution guard skeleton.
// Purpose: prove migration execution remains blocked and non-mutating in this stage.

import assert from "node:assert/strict";

import {
  MIGRATION_EXECUTION_GUARD_REASON,
  assertMigrationExecutionBlocked,
  buildMigrationExecutionGuard,
} from "../src/db/migrations/migrationExecutionGuard.js";

assert.equal(MIGRATION_EXECUTION_GUARD_REASON, "migration_execution_requires_explicit_future_approval");

const guard = buildMigrationExecutionGuard();

assert.equal(guard.ok, true);
assert.equal(guard.type, "migration_execution_guard");
assert.equal(guard.executionAllowed, false);
assert.equal(guard.reason, "migration_execution_requires_explicit_future_approval");
assert.equal(guard.willMutateDatabase, false);
assert.equal(guard.rules.noDefaultExecution, true);
assert.equal(guard.rules.noQueryExecution, true);
assert.equal(guard.rules.noStartupExecution, true);
assert.equal(guard.rules.noTelegramExecution, true);
assert.equal(guard.rules.noAiExecution, true);
assert.equal(guard.rules.noProjectMemoryWrite, true);
assert.equal(guard.rules.explicitApprovalRequired, true);

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

console.log("OK: migration execution guard skeleton blocks execution and remains non-mutating");
