// scripts/smokeMigrationDbReadinessCheck.js
// SG 2.0 smoke test for migration DB readiness diagnostics.
// Purpose: prove DB readiness diagnostics are read-only and never execute migrations.

import assert from "node:assert/strict";

import {
  MIGRATION_DB_READINESS_CHECK_NAME,
  runMigrationDbReadinessCheck,
} from "../src/diagnostics/migrationDbReadinessCheck.js";

let queryCalls = 0;

const notConfigured = await runMigrationDbReadinessCheck({
  databaseConfigured: false,
  queryFn: async () => {
    queryCalls += 1;
    throw new Error("must_not_query_when_database_not_configured");
  },
});

assert.equal(notConfigured.ok, false);
assert.equal(notConfigured.name, MIGRATION_DB_READINESS_CHECK_NAME);
assert.equal(notConfigured.willMutateDatabase, false);
assert.equal(notConfigured.database.configured, false);
assert.equal(notConfigured.database.queryExecuted, false);
assert.equal(notConfigured.safety.noDbMutation, true);
assert.equal(notConfigured.safety.noTransactionOpened, true);
assert.equal(notConfigured.safety.noMigrationExecution, true);
assert.equal(notConfigured.safety.noLedgerWrite, true);
assert.equal(queryCalls, 0);

const success = await runMigrationDbReadinessCheck({
  databaseConfigured: true,
  queryFn: async (text, params) => {
    queryCalls += 1;
    assert.equal(text, "SELECT 1 AS ok");
    assert.deepEqual(params, []);
    return {
      ok: true,
      rows: [{ ok: 1 }],
      rowCount: 1,
    };
  },
});

assert.equal(success.ok, true);
assert.equal(success.type, "diagnostics_check");
assert.equal(success.name, MIGRATION_DB_READINESS_CHECK_NAME);
assert.equal(success.mode, "read_only_connectivity_check");
assert.equal(success.willMutateDatabase, false);
assert.equal(success.database.configured, true);
assert.equal(success.database.connectivityChecked, true);
assert.equal(success.database.queryExecuted, true);
assert.equal(success.result.ok, true);
assert.equal(success.result.rowCount, 1);
assert.equal(success.safety.readOnly, true);
assert.equal(success.safety.noDbMutation, true);
assert.equal(success.safety.noTransactionOpened, true);
assert.equal(success.safety.noMigrationExecution, true);
assert.equal(success.safety.noSqlMigrationExecution, true);
assert.equal(success.safety.noLedgerWrite, true);
assert.equal(success.safety.noSchemaCreation, true);
assert.equal(queryCalls, 1);

const failed = await runMigrationDbReadinessCheck({
  databaseConfigured: true,
  queryFn: async () => {
    queryCalls += 1;
    return {
      ok: false,
      reason: "synthetic_readiness_failure",
      rows: [],
      rowCount: 0,
    };
  },
});

assert.equal(failed.ok, false);
assert.equal(failed.willMutateDatabase, false);
assert.equal(failed.database.queryExecuted, true);
assert.equal(failed.result.ok, false);
assert.equal(failed.result.reason, "synthetic_readiness_failure");
assert.equal(failed.warnings[0].code, "migration_db_readiness_query_failed");
assert.equal(failed.safety.noDbMutation, true);
assert.equal(failed.safety.noTransactionOpened, true);
assert.equal(failed.safety.noMigrationExecution, true);
assert.equal(failed.safety.noLedgerWrite, true);
assert.equal(queryCalls, 2);

console.log("OK: migration DB readiness diagnostics are read-only");
