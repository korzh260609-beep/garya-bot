// scripts/smokeMigrationDbBackedLockPendingSkeleton.js
// SG 2.0 smoke test for DB-backed migration lock and pending detection skeleton.

import assert from "node:assert/strict";

import {
  buildMigrationExecutionLockPlan,
  buildMigrationExecutionLockSql,
} from "../src/db/migrations/migrationExecutionLock.js";
import {
  buildMigrationLedgerReadModel,
  buildMigrationLedgerSelectSql,
  readMigrationLedgerRows,
} from "../src/db/migrations/migrationLedgerReader.js";
import {
  buildMigrationPendingDetectionPlan,
  detectPendingMigrations,
} from "../src/db/migrations/migrationPendingDetector.js";
import { buildMigrationAutomaticOrchestrationPlan } from "../src/db/migrations/migrationAutomaticOrchestrator.js";

const lockSql = buildMigrationExecutionLockSql();
assert.equal(lockSql.ok, true);
assert.equal(lockSql.acquireSql, "SELECT pg_try_advisory_lock($1) AS acquired;");
assert.equal(lockSql.releaseSql, "SELECT pg_advisory_unlock($1) AS released;");

const lockPlan = buildMigrationExecutionLockPlan({ databaseConfigured: true });
assert.equal(lockPlan.ok, true);
assert.equal(lockPlan.mode, "db_backed_lock_plan_only");
assert.equal(lockPlan.implemented, true);
assert.equal(lockPlan.lockRequired, true);
assert.equal(lockPlan.lockAcquired, false);
assert.equal(lockPlan.acquireAttempted, false);
assert.equal(lockPlan.willMutateDatabase, false);
assert.equal(lockPlan.safety.advisoryLockAcquireNotExecuted, true);
assert.equal(lockPlan.safety.noSqlExecution, true);
assert.equal(lockPlan.safety.noDbMutation, true);

const selectSql = buildMigrationLedgerSelectSql();
assert.equal(selectSql.includes("SELECT id, name, module, status, direction, applied_at"), true);
assert.equal(selectSql.includes("WHERE status = 'applied' AND direction = 'up'"), true);

const ledgerModel = buildMigrationLedgerReadModel({
  rows: [
    {
      id: "001_project_memory_core",
      name: "Project Memory Core",
      module: "project_memory",
      status: "applied",
      direction: "up",
      applied_at: "2026-05-14T00:00:00.000Z",
    },
    {
      id: "ignored_down_migration",
      name: "Ignored",
      module: "core",
      status: "applied",
      direction: "down",
    },
    {
      id: "ignored_failed_migration",
      name: "Ignored Failed",
      module: "core",
      status: "failed",
      direction: "up",
    },
  ],
});
assert.equal(ledgerModel.ok, true);
assert.equal(ledgerModel.mode, "select_only_read_model");
assert.equal(ledgerModel.implemented, true);
assert.equal(ledgerModel.appliedCount, 1);
assert.deepEqual(ledgerModel.appliedIds, ["001_project_memory_core"]);
assert.equal(ledgerModel.willMutateDatabase, false);
assert.equal(ledgerModel.safety.selectOnly, true);
assert.equal(ledgerModel.safety.noLedgerWrite, true);

const customMigrations = [
  {
    id: "001_project_memory_core",
    name: "Project Memory Core",
    module: "project_memory",
    upSql: ["SELECT 1;"],
  },
  {
    id: "002_project_memory_indexes",
    name: "Project Memory Indexes",
    module: "project_memory",
    upSql: ["SELECT 2;"],
  },
];

const pending = detectPendingMigrations({
  migrations: customMigrations,
  ledgerReadModel: ledgerModel,
});
assert.equal(pending.length, 1);
assert.equal(pending[0].id, "002_project_memory_indexes");

const pendingPlan = buildMigrationPendingDetectionPlan({
  registry: customMigrations,
  ledgerReadModel: ledgerModel,
});
assert.equal(pendingPlan.ok, true);
assert.equal(pendingPlan.mode, "db_backed_read_only_comparison");
assert.equal(pendingPlan.implemented, true);
assert.equal(pendingPlan.pendingKnown, true);
assert.equal(pendingPlan.pendingCount, 1);
assert.equal(pendingPlan.pendingMigrations[0].id, "002_project_memory_indexes");
assert.equal(pendingPlan.willMutateDatabase, false);
assert.equal(pendingPlan.safety.readOnlyLedgerComparison, true);
assert.equal(pendingPlan.safety.noMigrationExecution, true);
assert.equal(pendingPlan.safety.noLedgerWrite, true);

const disabledLiveRead = await readMigrationLedgerRows({ allowLiveRead: false });
assert.equal(disabledLiveRead.ok, true);
assert.equal(disabledLiveRead.liveReadAttempted, false);
assert.equal(disabledLiveRead.willMutateDatabase, false);
assert.equal(disabledLiveRead.safety.selectOnly, true);

const injectedLiveRead = await readMigrationLedgerRows({
  allowLiveRead: true,
  query: async () => ({
    ok: true,
    rows: [
      {
        id: "001_project_memory_core",
        name: "Project Memory Core",
        module: "project_memory",
        status: "applied",
        direction: "up",
      },
    ],
    rowCount: 1,
  }),
});
assert.equal(injectedLiveRead.ok, true);
assert.equal(injectedLiveRead.liveReadAttempted, true);
assert.equal(injectedLiveRead.rowCount, 1);
assert.equal(injectedLiveRead.willMutateDatabase, false);
assert.equal(injectedLiveRead.safety.noLedgerWrite, true);

const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan({
  lockPlan,
  pendingPlan,
  databaseConfigured: true,
});
assert.equal(orchestrationPlan.ok, true);
assert.equal(orchestrationPlan.mode, "automatic_orchestration_db_backed_skeleton");
assert.equal(orchestrationPlan.implemented, true);
assert.equal(orchestrationPlan.executionBlocked, true);
assert.equal(orchestrationPlan.willMutateDatabase, false);
assert.equal(orchestrationPlan.visibility.dbBackedLockBoundaryReady, true);
assert.equal(orchestrationPlan.visibility.pendingDetectionImplemented, true);
assert.equal(orchestrationPlan.visibility.pendingKnown, true);
assert.equal(orchestrationPlan.visibility.pendingCount, 1);
assert.equal(orchestrationPlan.safety.noMigrationExecution, true);
assert.equal(orchestrationPlan.safety.noLedgerWrite, true);
assert.equal(orchestrationPlan.safety.noDbMutation, true);

console.log("OK: DB-backed migration lock and pending detection skeleton is read-only and non-executing");
