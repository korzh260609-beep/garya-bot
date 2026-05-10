// scripts/smokeDiagnosticsDefaultPlanJournalHealth.js
// SG 2.0 smoke test for default Diagnostics Plan journal health coverage.
// Purpose: prove default diagnostics includes the read-only Observation Journal Health latest check.

import assert from "node:assert/strict";

import { buildDiagnosticsPlan, getDefaultDiagnosticsChecks } from "../src/diagnostics/diagnosticsPlan.js";

const defaultChecks = getDefaultDiagnosticsChecks();
const plan = buildDiagnosticsPlan({
  text: "check SG diagnostics",
});

assert.equal(Array.isArray(defaultChecks), true);
assert.equal(defaultChecks.includes("observation_journal_health_latest"), true);
assert.equal(Array.isArray(plan.checks), true);
assert.equal(plan.checks.includes("observation_journal_health_latest"), true);
assert.equal(plan.rules.noWrites, true);
assert.equal(plan.rules.noSecrets, true);
assert.equal(plan.rules.noSlashCommands, true);
assert.equal(plan.rules.noTransportDependency, true);
assert.equal(plan.rules.noCoreMutation, true);

console.log("OK: default diagnostics plan includes observation_journal_health_latest");
