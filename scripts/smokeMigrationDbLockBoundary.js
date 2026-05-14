// scripts/smokeMigrationDbLockBoundary.js
// SG 2.0 smoke test for migration DB advisory lock boundary.

import assert from "node:assert/strict";

import {
  acquireMigrationExecutionLock,
  buildMigrationExecutionLockPlan,
  releaseMigrationExecutionLock,
} from "../src/db/migrations/migrationExecutionLock.js";

const plan = buildMigrationExecutionLockPlan({ databaseConfigured: true });
assert.equal(plan.ok, true);
assert.equal(plan.mode, "db_backed_lock_boundary");
assert.equal(plan.implemented, true);
assert.equal(plan.lockAcquired, false);
assert.equal(plan.acquireAttempted, false);
assert.equal(plan.willMutateDatabase, false);
assert.equal(plan.safety.advisoryLockAcquireRequiresExplicitApproval, true);
assert.equal(plan.safety.noDbDataMutation, true);
assert.equal(plan.safety.noMigrationExecution, true);
assert.equal(plan.safety.noLedgerWrite, true);

const skippedAcquire = await acquireMigrationExecutionLock({
  client: {
    async query() {
      throw new Error("query_must_not_run_without_explicit_approval");
    },
  },
});
assert.equal(skippedAcquire.ok, false);
assert.equal(skippedAcquire.status, "skipped");
assert.equal(skippedAcquire.reason, "migration_execution_lock_explicit_approval_required");
assert.equal(skippedAcquire.acquireAttempted, false);
assert.equal(skippedAcquire.lockAcquired, false);
assert.equal(skippedAcquire.willMutateDatabase, false);

const skippedRelease = await releaseMigrationExecutionLock({
  client: {
    async query() {
      throw new Error("query_must_not_run_without_explicit_approval");
    },
  },
});
assert.equal(skippedRelease.ok, false);
assert.equal(skippedRelease.status, "skipped");
assert.equal(skippedRelease.reason, "migration_execution_lock_explicit_approval_required");
assert.equal(skippedRelease.releaseAttempted, false);
assert.equal(skippedRelease.lockReleased, false);
assert.equal(skippedRelease.willMutateDatabase, false);

const missingClient = await acquireMigrationExecutionLock({ explicitApproval: true });
assert.equal(missingClient.ok, false);
assert.equal(missingClient.reason, "migration_execution_lock_client_required");
assert.equal(missingClient.acquireAttempted, false);

const queries = [];
const client = {
  async query(text, values = []) {
    queries.push({ text, values });

    if (text.includes("pg_try_advisory_lock")) {
      return { rows: [{ acquired: true }], rowCount: 1 };
    }

    if (text.includes("pg_advisory_unlock")) {
      return { rows: [{ released: true }], rowCount: 1 };
    }

    throw new Error("unexpected_query");
  },
};

const acquired = await acquireMigrationExecutionLock({
  client,
  explicitApproval: true,
});
assert.equal(acquired.ok, true);
assert.equal(acquired.status, "acquired");
assert.equal(acquired.lockAcquired, true);
assert.equal(acquired.acquireAttempted, true);
assert.equal(acquired.willMutateDatabase, false);
assert.equal(acquired.safety.advisorySessionStateChanged, true);
assert.equal(acquired.safety.noDbDataMutation, true);

const released = await releaseMigrationExecutionLock({
  client,
  explicitApproval: true,
});
assert.equal(released.ok, true);
assert.equal(released.status, "released");
assert.equal(released.lockReleased, true);
assert.equal(released.releaseAttempted, true);
assert.equal(released.willMutateDatabase, false);
assert.equal(released.safety.advisorySessionStateChanged, true);
assert.equal(released.safety.noDbDataMutation, true);

assert.equal(queries.length, 2);
assert.equal(queries[0].text, "SELECT pg_try_advisory_lock($1) AS acquired;");
assert.equal(queries[1].text, "SELECT pg_advisory_unlock($1) AS released;");

console.log("OK: migration DB advisory lock boundary requires explicit approval and injected client");
