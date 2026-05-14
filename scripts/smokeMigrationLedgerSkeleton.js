// scripts/smokeMigrationLedgerSkeleton.js
// SG 2.0 smoke test for migration ledger skeleton.
// Purpose: prove ledger governance is plan-only and cannot mutate DB in this stage.

import assert from "node:assert/strict";

import {
  MIGRATION_LEDGER_TABLE,
  buildMigrationLedgerPlan,
  buildMigrationLedgerTableSql,
  getMigrationLedgerTableName,
} from "../src/db/migrations/migrationLedger.js";

assert.equal(MIGRATION_LEDGER_TABLE, "sg_schema_migrations");
assert.equal(getMigrationLedgerTableName(), "sg_schema_migrations");

const sql = buildMigrationLedgerTableSql();

assert.equal(Array.isArray(sql), true);
assert.equal(sql.length > 0, true);
assert.equal(sql.some((line) => line.includes("CREATE TABLE IF NOT EXISTS sg_schema_migrations")), true);
assert.equal(sql.some((line) => line.includes("PRIMARY KEY")), true);
assert.equal(sql.some((line) => line.includes("CREATE INDEX IF NOT EXISTS")), true);

const plan = buildMigrationLedgerPlan();

assert.equal(plan.ok, true);
assert.equal(plan.type, "migration_ledger_plan");
assert.equal(plan.mode, "plan_only");
assert.equal(plan.tableName, "sg_schema_migrations");
assert.equal(plan.willMutateDatabase, false);
assert.equal(plan.sqlCount, plan.sql.length);
assert.equal(plan.rules.noQueryExecution, true);
assert.equal(plan.rules.noStartupExecution, true);
assert.equal(plan.rules.noTelegramExecution, true);
assert.equal(plan.rules.noAiExecution, true);
assert.equal(plan.rules.noProjectMemoryWrite, true);
assert.equal(plan.rules.explicitApprovalRequired, true);

const emptySql = buildMigrationLedgerTableSql({ tableName: "" });
const emptyPlan = buildMigrationLedgerPlan({ tableName: "" });

assert.deepEqual(emptySql, []);
assert.equal(emptyPlan.ok, false);
assert.equal(emptyPlan.willMutateDatabase, false);

console.log("OK: migration ledger skeleton is plan-only and non-mutating");
