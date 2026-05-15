// scripts/smokeMigrationAutomaticExecutorBoundary.js
// SG 2.0 smoke test for automatic migration executor boundary.

import assert from "node:assert/strict";

import {
  buildMigrationAutomaticExecutionPlan,
  runLockedMigrationAutomaticExecution,
  runMigrationAutomaticExecution,
} from "../src/db/migrations/migrationAutomaticExecutor.js";
import { MIGRATION_EXECUTION_DECISIONS } from "../src/db/migrations/migrationExecutionController.js";

const baseDecision = {
  ok: true,
  type: "migration_execution_decision",
  decision: MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION,
  reason: "test_ready",
  runtimeConfig: {
    env: {
      runMigrationsOnBoot: {
        enabled: true,
      },
    },
  },
};

const allowGuard = {
  ok: true,
  type: "migration_execution_guard",
  executionAllowed: true,
  reason: "test_guard_allows_execution",
  willMutateDatabase: false,
};

const registry = [
  {
    id: "001_test_migration",
    name: "Test Migration",
    module: "test",
    upSql: ["SELECT 1;"],
  },
];

const pendingPlan = {
  ok: true,
  type: "migration_pending_detection_plan",
  implemented: true,
  pendingKnown: true,
  pendingCount: 1,
  pendingMigrations: [
    {
      id: "001_test_migration",
      name: "Test Migration",
      module: "test",
      sqlCount: 1,
    },
  ],
  safety: {
    readOnlyLedgerComparison: true,
  },
};

function createTestClient({ failMigrationSql = false } = {}) {
  const queries = [];

  const client = {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });

      if (text.includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }], rowCount: 1 };
      }

      if (text.includes("pg_advisory_unlock")) {
        return { rows: [{ released: true }], rowCount: 1 };
      }

      if (failMigrationSql && text === "SELECT 1;") {
        throw new Error("forced_migration_sql_failure");
      }

      return {
        rowCount: 1,
        rows: [
          {
            id: "001_test_migration",
            name: "Test Migration",
            module: "test",
            status: "applied",
            direction: "up",
            sql_count: 1,
          },
        ],
      };
    },
  };

  return client;
}

const defaultPlan = buildMigrationAutomaticExecutionPlan({
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  lockAcquired: true,
});
assert.equal(defaultPlan.ok, true);
assert.equal(defaultPlan.ready, false);
assert.equal(defaultPlan.reason, "migration_automatic_execution_explicit_approval_required");
assert.equal(defaultPlan.willMutateDatabase, false);
assert.equal(defaultPlan.safety.noDefaultExecution, true);
assert.equal(defaultPlan.safety.explicitApprovalRequired, true);

const noLockPlan = buildMigrationAutomaticExecutionPlan({
  explicitApproval: true,
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  lockAcquired: false,
});
assert.equal(noLockPlan.ready, false);
assert.equal(noLockPlan.reason, "migration_automatic_execution_lock_not_acquired");
assert.equal(noLockPlan.willMutateDatabase, false);

const readyPlan = buildMigrationAutomaticExecutionPlan({
  explicitApproval: true,
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  lockAcquired: true,
});
assert.equal(readyPlan.ready, true);
assert.equal(readyPlan.reason, "migration_automatic_execution_ready");
assert.equal(readyPlan.pendingCount, 1);
assert.equal(readyPlan.willMutateDatabase, true);
assert.equal(readyPlan.safety.noStartupHookConnection, true);
assert.equal(readyPlan.safety.noProjectMemoryWrite, true);

const skippedResult = await runMigrationAutomaticExecution({
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  lockAcquired: true,
});
assert.equal(skippedResult.ok, false);
assert.equal(skippedResult.status, "skipped");
assert.equal(skippedResult.reason, "migration_automatic_execution_explicit_approval_required");
assert.equal(skippedResult.willMutateDatabase, false);
assert.equal(skippedResult.appliedCount, 0);
assert.equal(skippedResult.failedCount, 0);

let transactionCalls = 0;
const executedResult = await runMigrationAutomaticExecution({
  explicitApproval: true,
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  lockAcquired: true,
  withTransaction: async (callback) => {
    transactionCalls += 1;
    return callback(createTestClient());
  },
});
assert.equal(transactionCalls, 1);
assert.equal(executedResult.ok, true);
assert.equal(executedResult.status, "completed");
assert.equal(executedResult.appliedCount, 1);
assert.equal(executedResult.failedCount, 0);
assert.equal(executedResult.willMutateDatabase, true);
assert.equal(executedResult.results[0].status, "applied");

const lockedSkippedResult = await runLockedMigrationAutomaticExecution({
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  withTransaction: async () => {
    throw new Error("locked_execution_must_not_start_without_explicit_approval");
  },
});
assert.equal(lockedSkippedResult.ok, false);
assert.equal(lockedSkippedResult.status, "skipped");
assert.equal(lockedSkippedResult.reason, "migration_automatic_execution_explicit_approval_required");
assert.equal(lockedSkippedResult.willMutateDatabase, false);
assert.equal(lockedSkippedResult.lockAcquire, null);
assert.equal(lockedSkippedResult.lockRelease, null);

let lockedTransactionCalls = 0;
const lockedClient = createTestClient();
const lockedExecutedResult = await runLockedMigrationAutomaticExecution({
  explicitApproval: true,
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  withTransaction: async (callback) => {
    lockedTransactionCalls += 1;
    return callback(lockedClient);
  },
});
assert.equal(lockedTransactionCalls, 1);
assert.equal(lockedExecutedResult.ok, true);
assert.equal(lockedExecutedResult.status, "completed");
assert.equal(lockedExecutedResult.lockAcquire.lockAcquired, true);
assert.equal(lockedExecutedResult.execution.status, "completed");
assert.equal(lockedExecutedResult.execution.appliedCount, 1);
assert.equal(lockedExecutedResult.lockRelease.lockReleased, true);
assert.equal(lockedExecutedResult.safety.sameClientForLockAndExecution, true);
assert.equal(lockedExecutedResult.safety.lockReleaseAttempted, true);
assert.equal(lockedClient.queries[0].text, "SELECT pg_try_advisory_lock($1) AS acquired;");
assert.equal(lockedClient.queries.at(-1).text, "SELECT pg_advisory_unlock($1) AS released;");

let failingTransactionCalls = 0;
const failingClient = createTestClient({ failMigrationSql: true });
const failingLockedResult = await runLockedMigrationAutomaticExecution({
  explicitApproval: true,
  decision: baseDecision,
  guard: allowGuard,
  pendingPlan,
  registry,
  databaseConfigured: true,
  withTransaction: async (callback) => {
    failingTransactionCalls += 1;
    return callback(failingClient);
  },
});
assert.equal(failingTransactionCalls, 1);
assert.equal(failingLockedResult.ok, false);
assert.equal(failingLockedResult.status, "failed");
assert.equal(failingLockedResult.lockAcquire.lockAcquired, true);
assert.equal(failingLockedResult.lockRelease.lockReleased, true);
assert.equal(failingLockedResult.safety.lockReleaseAttempted, true);
assert.equal(failingClient.queries[0].text, "SELECT pg_try_advisory_lock($1) AS acquired;");
assert.equal(failingClient.queries.at(-1).text, "SELECT pg_advisory_unlock($1) AS released;");

console.log("OK: automatic migration executor boundary stays blocked by default and locked execution uses one client with release in failure path");
