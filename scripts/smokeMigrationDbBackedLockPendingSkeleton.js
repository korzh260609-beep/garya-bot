// scripts/smokeMigrationDbBackedLockPendingSkeleton.js
// SG 2.0 smoke test for DB-backed migration lock and pending detection skeleton.

import assert from "node:assert/strict";

import { buildMigrationExecutionLockPlan } from "../src/db/migrations/migrationExecutionLock.js";
import { buildMigrationLedgerReadModel, readMigrationLedgerRows } from "../src/db/migrations/migrationLedgerReader.js";
import { buildMigrationPendingDetectionPlan } from "../src/db/migrations/migrationPendingDetector.js";
import { buildMigrationAutomaticOrchestrationPlan } from "../src/db/migrations/migrationAutomaticOrchestrator.js";

const lockPlan = buildMigrationExecutionLockPlan({ databaseConfigured: true });
assert.equal(lockPlan.ok, true);
assert.equal(lockPlan.mode, "db_backed_lock_boundary");
assert.equal(lockPlan.implemented, true);
assert.equal(lockPlan.lockAcquired, false);
assert.equal(lockPlan.acquireAttempted, false);
assert.equal(lockPlan.willMutateDatabase, false);
assert.equal(lockPlan.safety.advisoryLockAcquireRequiresExplicitApproval, true);
assert.equal(lockPlan.safety.noDbDataMutation, true);
assert.equal(lockPlan.safety.noMigrationExecution, true);

const ledgerModel = buildMigrationLedgerReadModel({
  rows: [
    { id: "001_project_memory_core", status: "applied", direction: "up" },
    { id: "ignored_down_migration", status: "applied", direction: "down" },
    { id: "ignored_failed_migration", status: "failed", direction: "up" },
  ],
});
assert.equal(ledgerModel.ok, true);
assert.equal(ledgerModel.implemented, true);
assert.equal(ledgerModel.appliedCount, 1);
assert.deepEqual(ledgerModel.appliedIds, ["001_project_memory_core"]);
assert.equal(ledgerModel.willMutateDatabase, false);
assert.equal(ledgerModel.safety.selectOnly, true);
assert.equal(ledgerModel.safety.noLedgerWrite, true);

const registry = [
  { id: "001_project_memory_core", name: "Project Memory Core", module: "project_memory", upSql: ["SELECT 1;"] },
  { id: "002_project_memory_indexes", name: "Project Memory Indexes", module: "project_memory", upSql: ["SELECT 2;"] },
];

const pendingPlan = buildMigrationPendingDetectionPlan({ registry, ledgerReadModel: ledgerModel });
assert.equal(pendingPlan.ok, true);
assert.equal(pendingPlan.mode, "db_backed_read_only_comparison");
assert.equal(pendingPlan.implemented, true);
assert.equal(pendingPlan.pendingKnown, true);
assert.equal(pendingPlan.pendingCount, 1);
assert.equal(pendingPlan.willMutateDatabase, false);
assert.equal(pendingPlan.safety.readOnlyLedgerComparison, true);
assert.equal(pendingPlan.safety.noMigrationExecution, true);
assert.equal(pendingPlan.safety.noLedgerWrite, true);

const disabledLiveRead = await readMigrationLedgerRows({ allowLiveRead: false });
assert.equal(disabledLiveRead.ok, true);
assert.equal(disabledLiveRead.liveReadAttempted, false);
assert.equal(disabledLiveRead.willMutateDatabase, false);
assert.equal(disabledLiveRead.safety.selectOnly, true);

const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan({ lockPlan, pendingPlan, databaseConfigured: true });
assert.equal(orchestrationPlan.ok, true);
assert.equal(orchestrationPlan.mode, "automatic_orchestration_db_backed_skeleton");
assert.equal(orchestrationPlan.implemented, true);
assert.equal(orchestrationPlan.executionBlocked, true);
assert.equal(orchestrationPlan.willMutateDatabase, false);
assert.equal(orchestrationPlan.visibility.dbBackedLockBoundaryReady, true);
assert.equal(orchestrationPlan.visibility.pendingDetectionImplemented, true);
assert.equal(orchestrationPlan.safety.noMigrationExecution, true);
assert.equal(orchestrationPlan.safety.noLedgerWrite, true);
assert.equal(orchestrationPlan.safety.noDbMutation, true);

console.log("OK: migration DB-backed lock and pending detection skeleton is read-only and non-executing");
