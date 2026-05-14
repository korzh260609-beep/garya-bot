// scripts/smokeMigrationAutomaticExecutorBoundary.js
// SG 2.0 smoke test for automatic migration executor boundary.

import assert from "node:assert/strict";

import {
  buildMigrationAutomaticExecutionPlan,
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
    const client = {
      queries: [],
      async query(text, values = []) {
        this.queries.push({ text, values });
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
    return callback(client);
  },
});
assert.equal(transactionCalls, 1);
assert.equal(executedResult.ok, true);
assert.equal(executedResult.status, "completed");
assert.equal(executedResult.appliedCount, 1);
assert.equal(executedResult.failedCount, 0);
assert.equal(executedResult.willMutateDatabase, true);
assert.equal(executedResult.results[0].status, "applied");

console.log("OK: automatic migration executor boundary stays blocked by default and only runs with explicit gates");
