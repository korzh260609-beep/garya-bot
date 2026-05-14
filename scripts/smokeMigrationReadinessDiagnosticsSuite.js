// scripts/smokeMigrationReadinessDiagnosticsSuite.js
// SG 2.0 smoke test for migration readiness diagnostics suite.

import assert from "node:assert/strict";

import { detectDiagnosticsIntent } from "../src/diagnostics/diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "../src/diagnostics/diagnosticsPlan.js";
import {
  buildMigrationReadinessDiagnosticsSuite,
  getMigrationReadinessDiagnosticsChecks,
  isMigrationReadinessDiagnosticsRequest,
  MIGRATION_READINESS_DIAGNOSTICS_CHECKS,
  MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME,
} from "../src/diagnostics/migrationReadinessDiagnosticsSuite.js";

const expectedChecks = [
  "migration_governance",
  "migration_manual_execution_dry_run",
  "migration_manual_execution_preflight",
  "migration_db_readiness",
];

const checks = getMigrationReadinessDiagnosticsChecks();
assert.deepEqual(checks, expectedChecks);
assert.deepEqual(MIGRATION_READINESS_DIAGNOSTICS_CHECKS, expectedChecks);

const suite = buildMigrationReadinessDiagnosticsSuite({
  text: "проверь готовность миграций перед запуском",
});

assert.equal(suite.ok, true);
assert.equal(suite.type, "diagnostics_suite");
assert.equal(suite.name, MIGRATION_READINESS_DIAGNOSTICS_SUITE_NAME);
assert.equal(suite.mode, "read_only");
assert.equal(suite.requested, true);
assert.deepEqual(suite.checks, expectedChecks);
assert.equal(suite.safety.noDbMutation, true);
assert.equal(suite.safety.noTransactionOpened, true);
assert.equal(suite.safety.noMigrationExecution, true);
assert.equal(suite.safety.noSqlMigrationExecution, true);
assert.equal(suite.safety.noLedgerWrite, true);
assert.equal(suite.safety.noSchemaCreation, true);

assert.equal(isMigrationReadinessDiagnosticsRequest({
  text: "manual migration readiness check",
}), true);
assert.equal(isMigrationReadinessDiagnosticsRequest({
  text: "обычный статус сг",
}), false);

const intent = detectDiagnosticsIntent({
  text: "manual migration readiness check",
});
assert.equal(intent.ok, true);
assert.equal(intent.matchedHints.includes("migration readiness"), true);

const readinessPlan = buildDiagnosticsPlan({
  text: "manual migration readiness check",
  intent,
});

assert.equal(readinessPlan.ok, true);
assert.equal(readinessPlan.selectedSuite, "migration_readiness");
assert.deepEqual(readinessPlan.checks, expectedChecks);
assert.equal(readinessPlan.rules.noWrites, true);
assert.equal(readinessPlan.rules.noSecrets, true);
assert.equal(readinessPlan.rules.noTransportDependency, true);
assert.equal(readinessPlan.rules.noCoreMutation, true);
assert.equal(readinessPlan.rules.noMigrationExecution, true);

const explicitPlan = buildDiagnosticsPlan({
  text: "manual migration readiness check",
  checks: ["observation_journal_health_latest"],
});

assert.equal(explicitPlan.selectedSuite, "explicit");
assert.deepEqual(explicitPlan.checks, ["observation_journal_health_latest"]);

const defaultPlan = buildDiagnosticsPlan({
  text: "проверь обычный статус сг",
});

assert.equal(defaultPlan.selectedSuite, "default");
assert.equal(defaultPlan.checks.includes("observation_journal_health_latest"), true);
assert.equal(defaultPlan.checks.includes("migration_db_readiness"), false);

console.log("OK: migration readiness diagnostics suite routes safely");
