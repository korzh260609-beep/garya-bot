// scripts/smokeMigrationRunnerSkeleton.js
// SG 2.0 smoke test for migration runner skeleton.
// Purpose: prove migration governance is plan-only and cannot mutate DB in this stage.

import assert from "node:assert/strict";

import { validateMigrationRegistry } from "../src/db/migrations/migrationRegistry.js";
import { buildMigrationPlan, runMigrations } from "../src/db/migrations/migrationRunner.js";

const validation = validateMigrationRegistry();

assert.equal(validation.ok, true);
assert.equal(validation.count, 1);
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
assert.equal(plan.migrations.length, 1);
assert.equal(plan.migrations[0].id, "001_project_memory_core");
assert.equal(plan.migrations[0].name, "project_memory_core");
assert.equal(plan.migrations[0].module, "project_memory");
assert.equal(plan.migrations[0].status, "pending");
assert.equal(plan.migrations[0].sqlCount > 0, true);

const execution = await runMigrations();

assert.equal(execution.ok, false);
assert.equal(execution.reason, "migration_execution_not_implemented_in_skeleton");
assert.equal(execution.willMutateDatabase, false);

console.log("OK: migration runner skeleton includes Project Memory definition and remains non-mutating");
