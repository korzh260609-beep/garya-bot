// scripts/smokeMigrationAutomaticExecutionPreflight.js
// SG 2.0 smoke test for automatic migration execution preflight visibility.
// Purpose: prove automatic preflight can inspect readiness without acquiring locks, opening transactions, or executing migrations.

import assert from "node:assert/strict";

import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import {
  buildAutomaticMigrationExecutionPreflight,
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS,
} from "../src/db/migrations/migrationAutomaticExecutionPreflight.js";
import {
  MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME,
  runMigrationAutomaticExecutionPreflightCheck,
} from "../src/diagnostics/migrationAutomaticExecutionPreflightCheck.js";

let transactionOpened = false;

const configuredBlocked = buildAutomaticMigrationExecutionPreflight({
  databaseConfigured: true,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_during_automatic_preflight");
  },
});

assert.equal(configuredBlocked.ok, true);
assert.equal(configuredBlocked.reason, MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.EXECUTION_STILL_BLOCKED);
assert.equal(configuredBlocked.willMutateDatabase, false);
assert.equal(configuredBlocked.database.configured, true);
assert.equal(configuredBlocked.runtimeGates.simulatedForReadiness, true);
assert.equal(configuredBlocked.runtimeGates.simulationAllowedToExecute, false);
assert.equal(configuredBlocked.transaction.boundaryAvailable, true);
assert.equal(configuredBlocked.transaction.opened, false);
assert.equal(configuredBlocked.lock.acquireAttempted, false);
assert.equal(configuredBlocked.lock.acquired, false);
assert.equal(configuredBlocked.execution.attempted, false);
assert.equal(configuredBlocked.execution.stillBlocked, true);
assert.equal(configuredBlocked.ledger.writeAttempted, false);
assert.equal(configuredBlocked.observationAfterExecution.required, true);
assert.equal(configuredBlocked.observationAfterExecution.executionReportAvailableNow, false);
assert.equal(configuredBlocked.safety.noDbMutation, true);
assert.equal(configuredBlocked.safety.noTransactionOpened, true);
assert.equal(configuredBlocked.safety.noAdvisoryLockAcquire, true);
assert.equal(configuredBlocked.safety.noSqlExecution, true);
assert.equal(configuredBlocked.safety.noLedgerWrite, true);
assert.equal(configuredBlocked.safety.noMigrationExecution, true);
assert.equal(configuredBlocked.safety.envGatesNotChanged, true);
assert.equal(transactionOpened, false);

const missingDatabase = buildAutomaticMigrationExecutionPreflight({
  databaseConfigured: false,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_without_database");
  },
});

assert.equal(missingDatabase.ok, false);
assert.equal(missingDatabase.reason, MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.DATABASE_NOT_CONFIGURED);
assert.equal(missingDatabase.willMutateDatabase, false);
assert.equal(missingDatabase.database.configured, false);
assert.equal(missingDatabase.transaction.opened, false);
assert.equal(missingDatabase.lock.acquireAttempted, false);
assert.equal(missingDatabase.execution.attempted, false);
assert.equal(transactionOpened, false);

const invalidRegistry = buildAutomaticMigrationExecutionPreflight({
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
assert.equal(invalidRegistry.reason, MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_REASONS.REGISTRY_INVALID);
assert.equal(invalidRegistry.registryValidation.ok, false);
assert.equal(invalidRegistry.willMutateDatabase, false);
assert.equal(invalidRegistry.transaction.opened, false);
assert.equal(invalidRegistry.lock.acquireAttempted, false);
assert.equal(invalidRegistry.execution.attempted, false);
assert.equal(transactionOpened, false);

const diagnosticsResult = runMigrationAutomaticExecutionPreflightCheck({
  databaseConfigured: true,
  transactionBoundary: async () => {
    transactionOpened = true;
    throw new Error("must_not_open_transaction_from_automatic_diagnostics");
  },
});

assert.equal(diagnosticsResult.ok, true);
assert.equal(diagnosticsResult.type, "diagnostics_check");
assert.equal(diagnosticsResult.name, MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME);
assert.equal(diagnosticsResult.mode, "read_only_automatic_preflight_visibility");
assert.equal(diagnosticsResult.willMutateDatabase, false);
assert.equal(diagnosticsResult.safety.noMigrationExecution, true);
assert.equal(diagnosticsResult.safety.noAdvisoryLockAcquire, true);
assert.equal(diagnosticsResult.preflight.transaction.opened, false);
assert.equal(diagnosticsResult.preflight.lock.acquireAttempted, false);
assert.equal(diagnosticsResult.preflight.execution.attempted, false);
assert.equal(transactionOpened, false);

const registryEntry = diagnosticsCheckRegistry.find(
  (entry) => entry.name === MIGRATION_AUTOMATIC_EXECUTION_PREFLIGHT_CHECK_NAME,
);

assert.equal(Boolean(registryEntry), true);

const registrySummary = registryEntry.summarize(diagnosticsResult);

assert.equal(registrySummary.includes("Automatic migration execution preflight OK"), true);

console.log("OK: automatic migration execution preflight is read-only and registered");
