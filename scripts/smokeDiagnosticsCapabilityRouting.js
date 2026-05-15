// scripts/smokeDiagnosticsCapabilityRouting.js
// SG 2.0 smoke test for diagnostics capability routing.
// Purpose: prove diagnostics routing uses structured intent/capability, not keyword or phrase matching.

import assert from "node:assert/strict";

import { detectDiagnosticsIntent } from "../src/diagnostics/diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "../src/diagnostics/diagnosticsPlan.js";
import {
  buildMigrationReadinessDiagnosticsSuite,
  getMigrationReadinessDiagnosticsChecks,
  isMigrationReadinessDiagnosticsRequest,
} from "../src/diagnostics/migrationReadinessDiagnosticsSuite.js";

const plainTextIntent = detectDiagnosticsIntent({
  text: "проверь готовность миграций",
});

assert.equal(plainTextIntent.ok, false);
assert.equal(plainTextIntent.reason, "no_structured_diagnostics_intent");
assert.equal(plainTextIntent.routing.keywordMatchingUsed, false);
assert.equal(plainTextIntent.routing.phraseMatchingUsed, false);
assert.deepEqual(plainTextIntent.matchedHints, []);

const plainTextPlan = buildDiagnosticsPlan({
  text: "проверь готовность миграций",
  intent: plainTextIntent.intent,
});

assert.equal(plainTextPlan.selectedSuite, "default");
assert.equal(plainTextPlan.routing.keywordMatchingUsed, false);
assert.equal(plainTextPlan.routing.phraseMatchingUsed, false);
assert.equal(plainTextPlan.checks.includes("migration_automatic_execution_preflight"), false);

const automaticCapabilityIntent = detectDiagnosticsIntent({
  text: "any user language is allowed here",
  intent: {
    domain: "diagnostics",
    action: "inspect",
    capability: "migration_automatic_execution_preflight",
  },
});

assert.equal(automaticCapabilityIntent.ok, true);
assert.equal(automaticCapabilityIntent.reason, "structured_diagnostics_intent");
assert.equal(automaticCapabilityIntent.confidence, 1);
assert.equal(automaticCapabilityIntent.intent.capability, "migration_automatic_execution_preflight");
assert.equal(automaticCapabilityIntent.routing.keywordMatchingUsed, false);
assert.equal(automaticCapabilityIntent.routing.phraseMatchingUsed, false);

const automaticPlan = buildDiagnosticsPlan({
  text: "any user language is allowed here",
  intent: automaticCapabilityIntent.intent,
});

assert.equal(automaticPlan.selectedSuite, "migration_automatic_execution_preflight");
assert.deepEqual(automaticPlan.checks, ["migration_automatic_execution_preflight"]);
assert.equal(automaticPlan.routing.source, "structured_capability");
assert.equal(automaticPlan.routing.keywordMatchingUsed, false);
assert.equal(automaticPlan.routing.phraseMatchingUsed, false);

const readinessIntent = {
  domain: "diagnostics",
  action: "inspect",
  diagnosticsSuite: "migration_readiness",
};

assert.equal(isMigrationReadinessDiagnosticsRequest({ intent: readinessIntent }), true);

const readinessSuite = buildMigrationReadinessDiagnosticsSuite({ intent: readinessIntent });
const readinessChecks = getMigrationReadinessDiagnosticsChecks();

assert.equal(readinessSuite.requested, true);
assert.equal(readinessSuite.routing.source, "structured_intent");
assert.equal(readinessSuite.routing.keywordMatchingUsed, false);
assert.equal(readinessSuite.routing.phraseMatchingUsed, false);
assert.equal(readinessChecks.includes("migration_automatic_execution_preflight"), true);
assert.equal(readinessChecks.includes("migration_manual_execution_preflight"), true);

const readinessPlan = buildDiagnosticsPlan({
  text: "language does not decide this route",
  intent: readinessIntent,
});

assert.equal(readinessPlan.selectedSuite, "migration_readiness");
assert.equal(readinessPlan.routing.source, "structured_suite");
assert.equal(readinessPlan.checks.includes("migration_automatic_execution_preflight"), true);
assert.equal(readinessPlan.routing.keywordMatchingUsed, false);
assert.equal(readinessPlan.routing.phraseMatchingUsed, false);

console.log("OK: diagnostics routing uses structured intent/capability without keyword or phrase matching");
