// scripts/smokeMigrationManualExecutionBoundary.js
// SG 2.0 smoke test for manual migration execution boundary.
// Purpose: prove execution path is callable only with injected ready decision and injected transaction boundary.

import assert from "node:assert/strict";

import { MIGRATION_EXECUTION_DECISIONS } from "../src/db/migrations/migrationExecutionController.js";
import {
  MIGRATION_MANUAL_EXECUTION_REASONS,
  canRunManualMigrationExecution,
  runManualMigrationExecution,
} from "../src/db/migrations/migrationManualExecutionBoundary.js";

const registry = [
  {
    id: "001_project_memory_core",
    name: "project_memory_core",
    module: "project_memory",
    upSql: ["SELECT 1", "SELECT 2"],
  },
];

const blockedDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.BLOCKED_BY_GUARD,
};

const readyDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION,
};

const blocked = canRunManualMigrationExecution({
  decision: blockedDecision,
  registry,
  withTransaction() {},
});

assert.equal(blocked.ok, false);
assert.equal(blocked.reason, MIGRATION_MANUAL_EXECUTION_REASONS.DECISION_NOT_READY);
assert.equal(blocked.migrationCount, 1);

const blockedResult = await runManualMigrationExecution({
  decision: blockedDecision,
  registry,
  withTransaction() {
    throw new Error("must_not_open_transaction_when_blocked");
  },
});

assert.equal(blockedResult.ok, false);
assert.equal(blockedResult.status, "skipped");
assert.equal(blockedResult.willMutateDatabase, false);
assert.equal(blockedResult.results.length, 0);
assert.equal(blockedResult.rules.noStartupExecution, true);
assert.equal(blockedResult.rules.noEnvRead, true);
assert.equal(blockedResult.rules.noDirectPostgresImport, true);

const missingTransaction = canRunManualMigrationExecution({
  decision: readyDecision,
  registry,
  withTransaction: null,
});

assert.equal(missingTransaction.ok, false);
assert.equal(
  missingTransaction.reason,
  MIGRATION_MANUAL_EXECUTION_REASONS.TRANSACTION_BOUNDARY_REQUIRED,
);

const invalidRegistry = canRunManualMigrationExecution({
  decision: readyDecision,
  withTransaction() {},
  registry: [
    {
      id: "",
      name: "broken",
      upSql: [],
    },
  ],
});

assert.equal(invalidRegistry.ok, false);
assert.equal(invalidRegistry.reason, MIGRATION_MANUAL_EXECUTION_REASONS.REGISTRY_INVALID);

const executed = [];
const fakeClient = {
  async query(text, values = []) {
    executed.push({ text, values });
    return {
      rowCount: 1,
      rows: [
        {
          id: values[0] || "",
          status: values[3] || "",
        },
      ],
    };
  },
};

let transactionCount = 0;
const result = await runManualMigrationExecution({
  decision: readyDecision,
  registry,
  async withTransaction(callback) {
    transactionCount += 1;
    return callback(fakeClient);
  },
});

assert.equal(transactionCount, 1);
assert.equal(result.ok, true);
assert.equal(result.status, "completed");
assert.equal(result.reason, "manual_migration_execution_completed");
assert.equal(result.mode, "manual_callable_boundary");
assert.equal(result.willMutateDatabase, true);
assert.equal(result.migrationCount, 1);
assert.equal(result.results.length, 1);
assert.equal(result.summary.total, 1);
assert.equal(result.summary.applied, 1);
assert.equal(result.summary.failed, 0);
assert.equal(result.rules.injectedDecisionRequired, true);
assert.equal(result.rules.injectedTransactionBoundaryRequired, true);
assert.equal(executed.length, 4);
assert.match(executed[0].text, /INSERT INTO sg_schema_migrations/);
assert.equal(executed[0].values[3], "pending");
assert.equal(executed[3].values[3], "applied");

console.log("OK: manual migration execution boundary requires injected decision and injected transaction boundary");
