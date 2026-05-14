// scripts/smokeMigrationAutomaticOrchestrationSkeleton.js
// SG 2.0 smoke test for automatic migration orchestration skeleton.

import assert from "node:assert/strict";

import { buildMigrationAutomaticOrchestrationPlan } from "../src/db/migrations/migrationAutomaticOrchestrator.js";
import { buildMigrationDbReadinessPlan } from "../src/db/migrations/migrationAutomaticReadinessPlan.js";
import { buildMigrationExecutionLockPlan } from "../src/db/migrations/migrationExecutionLock.js";
import { buildMigrationPendingDetectionPlan } from "../src/db/migrations/migrationPendingDetector.js";

const lockPlan = buildMigrationExecutionLockPlan();
assert.equal(lockPlan.ok, true);
assert.equal(lockPlan.mode, "plan_only");
assert.equal(lockPlan.implemented, false);
assert.equal(lockPlan.lockRequired, true);
assert.equal(lockPlan.lockAcquired, false);
assert.equal(lockPlan.willMutateDatabase, false);
assert.equal(lockPlan.safety.noMigrationExecution, true);
assert.equal(lockPlan.safety.noDbMutation, true);

const pendingPlan = buildMigrationPendingDetectionPlan();
assert.equal(pendingPlan.ok, true);
assert.equal(pendingPlan.mode, "registry_only_plan");
assert.equal(pendingPlan.implemented, false);
assert.equal(pendingPlan.pendingKnown, false);
assert.equal(pendingPlan.pendingCount, null);
assert.equal(Array.isArray(pendingPlan.registeredMigrations), true);
assert.equal(pendingPlan.migrationCount >= 1, true);
assert.equal(pendingPlan.willMutateDatabase, false);
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
assert.equal(orchestrationPlan.mode, "automatic_orchestration_skeleton");
assert.equal(orchestrationPlan.implemented, false);
assert.equal(orchestrationPlan.executionBlocked, true);
assert.equal(orchestrationPlan.willMutateDatabase, false);
assert.equal(orchestrationPlan.lockPlan.lockRequired, true);
assert.equal(orchestrationPlan.pendingPlan.pendingKnown, false);
assert.equal(orchestrationPlan.dbReadinessPlan.connectivityChecked, false);
assert.equal(orchestrationPlan.startupHook.planned, true);
assert.equal(orchestrationPlan.startupHook.installed, false);
assert.equal(orchestrationPlan.startupHook.enabledByDefault, false);
assert.equal(orchestrationPlan.report.observationPlanned, true);
assert.equal(orchestrationPlan.report.observationWritten, false);
assert.equal(orchestrationPlan.safety.noDbMutation, true);
assert.equal(orchestrationPlan.safety.noTransactionOpened, true);
assert.equal(orchestrationPlan.safety.noSqlExecution, true);
assert.equal(orchestrationPlan.safety.noMigrationExecution, true);
assert.equal(orchestrationPlan.safety.noLedgerWrite, true);
assert.equal(orchestrationPlan.safety.noSchemaCreation, true);
assert.equal(orchestrationPlan.safety.noStartupExecution, true);
assert.equal(orchestrationPlan.safety.envGateRequired, true);
assert.equal(orchestrationPlan.safety.lockRequiredBeforeFutureExecution, true);
assert.equal(orchestrationPlan.safety.pendingDetectionRequiredBeforeFutureExecution, true);
assert.equal(orchestrationPlan.safety.observationReportRequiredAfterFutureExecution, true);

console.log("OK: automatic migration orchestration skeleton is non-mutating");
