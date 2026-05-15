// scripts/smokeMigrationGovernanceCheck.js
// SG 2.0 smoke test for migration governance diagnostics.

import assert from "node:assert/strict";

import {
  MIGRATION_GOVERNANCE_CHECK_NAME,
  runMigrationGovernanceCheck,
} from "../src/diagnostics/migrationGovernanceCheck.js";

assert.equal(MIGRATION_GOVERNANCE_CHECK_NAME, "migration_governance");

const originalRunMigrationsOnBoot = process.env.RUN_MIGRATIONS_ON_BOOT;
const originalApproveMigrationsOnBoot = process.env.APPROVE_MIGRATIONS_ON_BOOT;
process.env.RUN_MIGRATIONS_ON_BOOT = "1";
delete process.env.APPROVE_MIGRATIONS_ON_BOOT;

const report = runMigrationGovernanceCheck();

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

assert.equal(report.ok, true);
assert.equal(report.type, "diagnostics_check");
assert.equal(report.name, "migration_governance");
assert.equal(report.willMutateDatabase, false);
assert.equal(report.executionAllowed, false);

assert.equal(report.runnerPlan.ok, true);
assert.equal(report.runnerPlan.type, "migration_plan");
assert.equal(report.runnerPlan.mode, "plan_only");
assert.equal(report.runnerPlan.willMutateDatabase, false);
assert.equal(report.runnerPlan.migrationCount, 1);

assert.equal(report.ledgerPlan.ok, true);
assert.equal(report.ledgerPlan.type, "migration_ledger_plan");
assert.equal(report.ledgerPlan.mode, "plan_only");
assert.equal(report.ledgerPlan.tableName, "sg_schema_migrations");
assert.equal(report.ledgerPlan.willMutateDatabase, false);
assert.equal(report.ledgerPlan.sqlCount > 0, true);

assert.equal(report.executionGuard.ok, true);
assert.equal(report.executionGuard.type, "migration_execution_guard");
assert.equal(report.executionGuard.executionAllowed, false);
assert.equal(report.executionGuard.reason, "migration_execution_requires_runtime_gates");
assert.equal(report.executionGuard.willMutateDatabase, false);
assert.equal(report.executionGuard.env.runMigrationsOnBoot, true);
assert.equal(report.executionGuard.env.approveMigrationsOnBoot, false);
assert.equal(report.executionGuard.env.runMigrationsOnBootEnvKey, "RUN_MIGRATIONS_ON_BOOT");
assert.equal(report.executionGuard.env.approveMigrationsOnBootEnvKey, "APPROVE_MIGRATIONS_ON_BOOT");

assert.equal(report.safety.noDbMutation, true);
assert.equal(report.safety.executionBlocked, true);
assert.equal(report.safety.noStartupExecution, true);
assert.equal(report.safety.noTelegramExecution, true);
assert.equal(report.safety.noAiExecution, true);
assert.equal(report.safety.noProjectMemoryWrite, true);
assert.equal(report.safety.existingMigrationBootEnvRecognized, true);

console.log("OK: migration governance diagnostics requires approval gate and remains blocked");
