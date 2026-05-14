// scripts/smokeMigrationManualExecutionPreflight.js
// SG 2.0 smoke test for manual migration execution preflight visibility.
// Purpose: prove preflight can inspect readiness without opening transactions or executing migrations.

import assert from "node:assert/strict";

import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import {
  buildManualMigrationExecutionPreflight,
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS,
} from "../src/db/migrations/migrationManualExecutionPreflight.js";
import {
  MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME,
  runMigrationManualExecutionPreflightCheck,
} from "../src/diagnostics/migrationManualExecutionPreflightCheck.js";

let transactionOpened = false;

const configuredBlocked = buildManualMigrationExecutionPreflight({
  databaseConfigured: true,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_during_preflight");
  },
});

assert.equal(configuredBlocked.ok, true);
assert.equal(configuredBlocked.reason, MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.EXECUTION_STILL_BLOCKED);
assert.equal(configuredBlocked.willMutateDatabase, false);
assert.equal(configuredBlocked.database.configured, true);
assert.equal(configuredBlocked.transaction.boundaryAvailable, true);
assert.equal(configuredBlocked.transaction.opened, false);
assert.equal(configuredBlocked.execution.attempted, false);
assert.equal(configuredBlocked.execution.stillBlocked, true);
assert.equal(configuredBlocked.execution.manualBoundaryAllowed, false);
assert.equal(configuredBlocked.safety.noDbMutation, true);
assert.equal(configuredBlocked.safety.noTransactionOpened, true);
assert.equal(configuredBlocked.safety.noSqlExecution, true);
assert.equal(configuredBlocked.safety.noLedgerWrite, true);
assert.equal(transactionOpened, false);

const missingDatabase = buildManualMigrationExecutionPreflight({
  databaseConfigured: false,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_without_database");
  },
});

assert.equal(missingDatabase.ok, false);
assert.equal(missingDatabase.reason, MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.DATABASE_NOT_CONFIGURED);
assert.equal(missingDatabase.willMutateDatabase, false);
assert.equal(missingDatabase.database.configured, false);
assert.equal(missingDatabase.transaction.opened, false);
assert.equal(missingDatabase.execution.attempted, false);
assert.equal(transactionOpened, false);

const invalidRegistry = buildManualMigrationExecutionPreflight({
  databaseConfigured: true,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_with_invalid_registry");
  },
  registry: [
    {
      id: "",
      name: "broken",
      upSql: [],
    },
  ],
});

assert.equal(invalidRegistry.ok, false);
assert.equal(invalidRegistry.reason, MIGRATION_MANUAL_EXECUTION_PREFLIGHT_REASONS.REGISTRY_INVALID);
assert.equal(invalidRegistry.registryValidation.ok, false);
assert.equal(invalidRegistry.willMutateDatabase, false);
assert.equal(invalidRegistry.transaction.opened, false);
assert.equal(invalidRegistry.execution.attempted, false);
assert.equal(transactionOpened, false);

const diagnosticsResult = runMigrationManualExecutionPreflightCheck({
  databaseConfigured: true,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_from_diagnostics");
  },
});

assert.equal(diagnosticsResult.ok, true);
assert.equal(diagnosticsResult.type, "diagnostics_check");
assert.equal(diagnosticsResult.name, MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME);
assert.equal(diagnosticsResult.mode, "read_only_preflight_visibility");
assert.equal(diagnosticsResult.willMutateDatabase, false);
assert.equal(diagnosticsResult.safety.noMigrationExecution, true);
assert.equal(diagnosticsResult.preflight.transaction.opened, false);
assert.equal(diagnosticsResult.preflight.execution.attempted, false);
assert.equal(transactionOpened, false);

const registryEntry = diagnosticsCheckRegistry.find(
  (entry) => entry.name === MIGRATION_MANUAL_EXECUTION_PREFLIGHT_CHECK_NAME,
);

assert.equal(Boolean(registryEntry), true);

const registrySummary = registryEntry.summarize(diagnosticsResult);

assert.equal(registrySummary.includes("preflight OK"), true);

console.log("OK: manual migration execution preflight is read-only and registered");
