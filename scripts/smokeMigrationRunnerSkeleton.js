// scripts/smokeMigrationRunnerSkeleton.js
// SG 2.0 smoke test for migration runner skeleton.
// Purpose: prove migration governance is plan-only and cannot mutate DB in this stage.

import assert from "node:assert/strict";

import { validateMigrationRegistry } from "../src/db/migrations/migrationRegistry.js";
import { buildMigrationPlan, runMigrations } from "../src/db/migrations/migrationRunner.js";

const validation = validateMigrationRegistry();

assert.equal(validation.ok, true);
assert.equal(validation.count, 0);
assert.deepEqual(validation.errors, []);

const plan = buildMigrationPlan();

assert.equal(plan.ok, true);
assert.equal(plan.type, "migration_plan");
assert.equal(plan.mode, "plan_only");
assert.equal(plan.willMutateDatabase, false);
assert.equal(plan.rules.noStartupExecution, true);
assert.equal(plan.rules.noTelegramExecution, true);
assert.equal(plan.rules.noAiExecution, true);
assert.equal(plan.rules.noProjectMemoryWrite, true);
assert.equal(plan.rules.explicitApprovalRequired, true);
assert.deepEqual(plan.migrations, []);

const execution = await runMigrations();

assert.equal(execution.ok, false);
assert.equal(execution.reason, "migration_execution_not_implemented_in_skeleton");
assert.equal(execution.willMutateDatabase, false);

console.log("OK: migration runner skeleton is plan-only and non-mutating");
