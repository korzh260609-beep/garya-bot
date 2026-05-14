// scripts/smokeMigrationAutomaticOrchestrationSkeleton.js
// SG 2.0 smoke test for automatic migration orchestration skeleton.

import assert from "node:assert/strict";

import { buildMigrationAutomaticOrchestrationPlan } from "../src/db/migrations/migrationAutomaticOrchestrator.js";
import { buildMigrationDbReadinessPlan } from "../src/db/migrations/migrationAutomaticReadinessPlan.js";
import { buildMigrationExecutionLockPlan } from "../src/db/migrations/migrationExecutionLock.js";
import { buildMigrationPendingDetectionPlan } from "../src/db/migrations/migrationPendingDetector.js";

const lockPlan = buildMigrationExecutionLockPlan();
assert.equal(lockPlan.ok, true);
assert.equal(lockPlan.mode, "db_backed_lock_boundary");
assert.equal(lockPlan.implemented, true);
assert.equal(lockPlan.lockRequired, true);
assert.equal(lockPlan.lockAcquired, false);
assert.equal(lockPlan.acquireAttempted, false);
assert.equal(lockPlan.willMutateDatabase, false);
assert.equal(lockPlan.safety.advisoryLockAcquireRequiresExplicitApproval, true);
assert.equal(lockPlan.safety.noMigrationExecution, true);
assert.equal(lockPlan.safety.noDbDataMutation, true);

const pendingPlan = buildMigrationPendingDetectionPlan();
assert.equal(pendingPlan.ok, true);
assert.equal(pendingPlan.mode, "db_backed_read_only_comparison");
assert.equal(pendingPlan.implemented, true);
assert.equal(pendingPlan.pendingKnown, true);
assert.equal(Number.isInteger(pendingPlan.pendingCount), true);
assert.equal(Array.isArray(pendingPlan.registeredMigrations), true);
assert.equal(pendingPlan.migrationCount >= 1, true);
assert.equal(pendingPlan.willMutateDatabase, false);
assert.equal(pendingPlan.safety.readOnlyLedgerComparison, true);
assert.equal(pendingPlan.safety.noMigrationExecution, true);
assert.equal(pendingPlan.safety.noDbMutation, true);

const dbReadinessPlan = buildMigrationDbReadinessPlan({ databaseConfigured: true });
assert.equal(dbReadinessPlan.ok, true);
assert.equal(dbReadinessPlan.mode, "plan_only");
assert.equal(dbReadinessPlan.implemented, false);
assert.equal(dbReadinessPlan.databaseConfigured, true);
assert.equal(dbReadinessPlan.connectivityChecked, false);
assert.equal(dbReadinessPlan.willMutateDatabase, false);
assert.equal(dbReadinessPlan.safety.noMigrationExecution, true);
assert.equal(dbReadinessPlan.safety.noDbMutation, true);

const orchestrationPlan = buildMigrationAutomaticOrchestrationPlan({
  databaseConfigured: true,
});

assert.equal(orchestrationPlan.ok, true);
assert.equal(orchestrationPlan.type, "migration_automatic_orchestration_plan");
assert.equal(orchestrationPlan.mode, "automatic_orchestration_db_backed_skeleton");
assert.equal(orchestrationPlan.implemented, true);
assert.equal(orchestrationPlan.executionBlocked, true);
assert.equal(orchestrationPlan.willMutateDatabase, false);
assert.equal(orchestrationPlan.visibility.dbBackedLockBoundaryReady, true);
assert.equal(orchestrationPlan.visibility.pendingDetectionImplemented, true);
assert.equal(orchestrationPlan.visibility.pendingKnown, true);
assert.equal(orchestrationPlan.lockPlan.lockRequired, true);
assert.equal(orchestrationPlan.pendingPlan.pendingKnown, true);
assert.equal(orchestrationPlan.dbReadinessPlan.connectivityChecked, false);
assert.equal(orchestrationPlan.startupHook.planned, true);
assert.equal(orchestrationPlan.startupHook.installed, false);
assert.equal(orchestrationPlan.startupHook.enabledByDefault, false);
assert.equal(orchestrationPlan.report.observationPlanned, true);
assert.equal(orchestrationPlan.report.observationWritten, false);
assert.equal(orchestrationPlan.safety.noDbMutation, true);
assert.equal(orchestrationPlan.safety.noTransactionOpened, true);
assert.equal(orchestrationPlan.safety.noSqlWriteExecution, true);
assert.equal(orchestrationPlan.safety.noMigrationExecution, true);
assert.equal(orchestrationPlan.safety.noLedgerWrite, true);
assert.equal(orchestrationPlan.safety.noSchemaCreation, true);
assert.equal(orchestrationPlan.safety.noStartupExecution, true);
assert.equal(orchestrationPlan.safety.envGateRequired, true);
assert.equal(orchestrationPlan.safety.lockRequiredBeforeFutureExecution, true);
assert.equal(orchestrationPlan.safety.pendingDetectionRequiredBeforeFutureExecution, true);
assert.equal(orchestrationPlan.safety.observationReportRequiredAfterFutureExecution, true);

console.log("OK: automatic migration orchestration DB-backed skeleton is non-mutating");
