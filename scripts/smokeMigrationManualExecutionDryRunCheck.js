// scripts/smokeMigrationManualExecutionDryRunCheck.js
// SG 2.0 smoke test for manual migration execution dry-run diagnostics visibility.
// Purpose: prove diagnostics expose assembled manual execution path without opening transactions or mutating DB.

import assert from "node:assert/strict";

import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import {
  MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME,
  runMigrationManualExecutionDryRunCheck,
} from "../src/diagnostics/migrationManualExecutionDryRunCheck.js";

const result = runMigrationManualExecutionDryRunCheck();

assert.equal(result.ok, true);
assert.equal(result.type, "diagnostics_check");
assert.equal(result.name, MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME);
assert.equal(result.mode, "read_only_dry_run_visibility");
assert.equal(result.willMutateDatabase, false);
assert.equal(result.executionPath.assembled, true);
assert.equal(result.executionPath.migrationCount >= 1, true);
assert.equal(result.automaticExecution.blocked, true);
assert.equal(result.automaticExecution.willMutateDatabase, false);
assert.equal(result.manualExecution.attempted, false);
assert.equal(result.manualExecution.allowed, false);
assert.equal(result.manualExecution.blocked, true);
assert.equal(result.manualExecution.transactionBoundaryInjected, false);
assert.equal(result.manualExecution.transactionOpened, false);
assert.equal(result.manualExecution.sqlExecuted, false);
assert.equal(result.manualExecution.ledgerWritten, false);
assert.equal(result.manualExecution.willMutateDatabase, false);
assert.equal(result.safety.dryRunOnly, true);
assert.equal(result.safety.noDbMutation, true);
assert.equal(result.safety.noTransactionOpened, true);
assert.equal(result.safety.noSqlExecution, true);
assert.equal(result.safety.noLedgerWrite, true);
assert.equal(result.safety.noStartupExecution, true);
assert.equal(result.safety.noRunMigrationsOnBootEnable, true);
assert.equal(result.safety.noTelegramExecution, true);
assert.equal(result.safety.noAiExecution, true);
assert.equal(result.safety.noProjectMemoryWrite, true);
assert.equal(result.safety.noDirectPostgresImport, true);

const invalidResult = runMigrationManualExecutionDryRunCheck({
  registry: [
    {
      id: "",
      name: "broken",
      upSql: [],
    },
  ],
});

assert.equal(invalidResult.ok, false);
assert.equal(invalidResult.willMutateDatabase, false);
assert.equal(invalidResult.registryValidation.ok, false);
assert.equal(invalidResult.safety.noDbMutation, true);
assert.equal(invalidResult.manualExecution.attempted, false);
assert.equal(invalidResult.manualExecution.transactionOpened, false);
assert.equal(invalidResult.manualExecution.sqlExecuted, false);
assert.equal(invalidResult.manualExecution.ledgerWritten, false);

const registryEntry = diagnosticsCheckRegistry.find(
  (entry) => entry.name === MIGRATION_MANUAL_EXECUTION_DRY_RUN_CHECK_NAME,
);

assert.equal(Boolean(registryEntry), true);

const registryResult = await registryEntry.run({});
const registrySummary = registryEntry.summarize(registryResult);

assert.equal(registryResult.ok, true);
assert.equal(registryResult.willMutateDatabase, false);
assert.equal(registrySummary.includes("dry-run visibility OK"), true);

console.log("OK: manual migration execution dry-run diagnostics are read-only and registered");
