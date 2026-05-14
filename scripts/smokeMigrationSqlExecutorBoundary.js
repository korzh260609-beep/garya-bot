// scripts/smokeMigrationSqlExecutorBoundary.js
// SG 2.0 smoke test for migration SQL executor boundary.
// Purpose: prove SQL execution requires explicit ready decision and injected client.

import assert from "node:assert/strict";

import { MIGRATION_EXECUTION_DECISIONS } from "../src/db/migrations/migrationExecutionController.js";
import {
  MIGRATION_SQL_EXECUTOR_REASONS,
  canExecuteMigrationSql,
  executeMigrationSql,
} from "../src/db/migrations/migrationSqlExecutor.js";

const migration = {
  id: "001_project_memory_core",
  name: "project_memory_core",
  upSql: ["SELECT 1", "SELECT 2"],
};

const blockedDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.BLOCKED_BY_GUARD,
};

const blocked = canExecuteMigrationSql({
  decision: blockedDecision,
  client: {
    query() {},
  },
  migration,
});

assert.equal(blocked.ok, false);
assert.equal(blocked.reason, MIGRATION_SQL_EXECUTOR_REASONS.DECISION_NOT_READY);
assert.equal(blocked.sqlCount, 2);

const blockedResult = await executeMigrationSql({
  decision: blockedDecision,
  client: {
    query() {
      throw new Error("must_not_execute_when_blocked");
    },
  },
  migration,
});

assert.equal(blockedResult.ok, false);
assert.equal(blockedResult.status, "skipped");
assert.equal(blockedResult.executedCount, 0);
assert.equal(blockedResult.willMutateDatabase, false);

const readyDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION,
};

const missingClient = canExecuteMigrationSql({
  decision: readyDecision,
  client: null,
  migration,
});

assert.equal(missingClient.ok, false);
assert.equal(missingClient.reason, MIGRATION_SQL_EXECUTOR_REASONS.CLIENT_REQUIRED);

const emptySql = canExecuteMigrationSql({
  decision: readyDecision,
  client: {
    query() {},
  },
  migration: {
    id: "empty",
    name: "empty",
    upSql: [],
  },
});

assert.equal(emptySql.ok, false);
assert.equal(emptySql.reason, MIGRATION_SQL_EXECUTOR_REASONS.SQL_LIST_EMPTY);

const executedSql = [];
const fakeClient = {
  async query(sql) {
    executedSql.push(sql);
    return { rowCount: 0, rows: [] };
  },
};

const allowed = canExecuteMigrationSql({
  decision: readyDecision,
  client: fakeClient,
  migration,
});

assert.equal(allowed.ok, true);
assert.equal(allowed.sqlCount, 2);

const applied = await executeMigrationSql({
  decision: readyDecision,
  client: fakeClient,
  migration,
});

assert.equal(applied.ok, true);
assert.equal(applied.status, "applied");
assert.equal(applied.executedCount, 2);
assert.equal(applied.willMutateDatabase, true);
assert.deepEqual(executedSql, ["SELECT 1", "SELECT 2"]);

console.log("OK: migration SQL executor boundary requires ready decision and injected client");
