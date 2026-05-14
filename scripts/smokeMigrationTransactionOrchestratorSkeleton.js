// scripts/smokeMigrationTransactionOrchestratorSkeleton.js
// SG 2.0 smoke test for migration ledger writer and transaction orchestration skeleton.
// Purpose: prove transaction execution requires explicit ready decision and injected transaction boundary.

import assert from "node:assert/strict";

import { MIGRATION_EXECUTION_DECISIONS } from "../src/db/migrations/migrationExecutionController.js";
import {
  MIGRATION_LEDGER_WRITER_REASONS,
  canWriteMigrationLedger,
  writeMigrationLedgerRecord,
} from "../src/db/migrations/migrationLedgerWriter.js";
import {
  MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS,
  canRunMigrationTransaction,
  runMigrationTransaction,
} from "../src/db/migrations/migrationTransactionOrchestrator.js";
import { MIGRATION_STATUSES } from "../src/db/migrations/migrationTypes.js";

const migration = {
  id: "001_project_memory_core",
  name: "project_memory_core",
  module: "project_memory",
  upSql: ["SELECT 1", "SELECT 2"],
};

const blockedDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.BLOCKED_BY_GUARD,
};

const readyDecision = {
  decision: MIGRATION_EXECUTION_DECISIONS.READY_FOR_FUTURE_EXECUTION,
};

const blockedLedger = canWriteMigrationLedger({
  decision: blockedDecision,
  client: {
    query() {},
  },
  record: {
    id: migration.id,
    name: migration.name,
    module: migration.module,
    status: MIGRATION_STATUSES.PENDING,
    direction: "up",
    sqlCount: 2,
  },
});

assert.equal(blockedLedger.ok, false);
assert.equal(blockedLedger.reason, MIGRATION_LEDGER_WRITER_REASONS.DECISION_NOT_READY);

const skippedLedgerWrite = await writeMigrationLedgerRecord({
  decision: blockedDecision,
  client: {
    query() {
      throw new Error("must_not_write_ledger_when_blocked");
    },
  },
  migration,
});

assert.equal(skippedLedgerWrite.ok, false);
assert.equal(skippedLedgerWrite.status, "skipped");
assert.equal(skippedLedgerWrite.willMutateDatabase, false);
assert.equal(skippedLedgerWrite.rowCount, 0);

const missingTransaction = canRunMigrationTransaction({
  decision: readyDecision,
  withTransaction: null,
  migration,
});

assert.equal(missingTransaction.ok, false);
assert.equal(
  missingTransaction.reason,
  MIGRATION_TRANSACTION_ORCHESTRATOR_REASONS.TRANSACTION_BOUNDARY_REQUIRED,
);

const blockedTransaction = await runMigrationTransaction({
  decision: blockedDecision,
  withTransaction() {
    throw new Error("must_not_start_transaction_when_blocked");
  },
  migration,
});

assert.equal(blockedTransaction.ok, false);
assert.equal(blockedTransaction.status, "skipped");
assert.equal(blockedTransaction.willMutateDatabase, false);

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

let transactionOpened = false;
const result = await runMigrationTransaction({
  decision: readyDecision,
  migration,
  async withTransaction(callback) {
    transactionOpened = true;
    return callback(fakeClient);
  },
});

assert.equal(transactionOpened, true);
assert.equal(result.ok, true);
assert.equal(result.status, "applied");
assert.equal(result.willMutateDatabase, true);
assert.equal(result.ledgerBefore.status, "written");
assert.equal(result.sql.status, "applied");
assert.equal(result.sql.executedCount, 2);
assert.equal(result.ledgerAfter.status, "written");
assert.equal(executed.length, 4);
assert.match(executed[0].text, /INSERT INTO sg_schema_migrations/);
assert.equal(executed[0].values[3], MIGRATION_STATUSES.PENDING);
assert.equal(executed[3].values[3], MIGRATION_STATUSES.APPLIED);

console.log("OK: migration transaction orchestration skeleton requires ready decision and injected transaction boundary");
