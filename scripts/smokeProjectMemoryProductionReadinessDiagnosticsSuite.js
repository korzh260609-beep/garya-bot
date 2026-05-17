// scripts/smokeProjectMemoryProductionReadinessDiagnosticsSuite.js
// SG 2.0 smoke test for Project Memory production readiness diagnostics suite routing.
// Purpose: prove structured diagnostics routing can select the live-evidence readiness checks without keyword or phrase matching.

import assert from "node:assert/strict";

import { buildDiagnosticsPlan } from "../src/diagnostics/diagnosticsPlan.js";
import {
  buildProjectMemoryProductionReadinessDiagnosticsSuite,
  getProjectMemoryProductionReadinessDiagnosticsChecks,
  isProjectMemoryProductionReadinessDiagnosticsRequest,
  PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
} from "../src/diagnostics/projectMemoryProductionReadinessDiagnosticsSuite.js";

const readinessIntent = {
  domain: "diagnostics",
  action: "inspect",
  diagnosticsSuite: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
};

assert.equal(isProjectMemoryProductionReadinessDiagnosticsRequest({ intent: readinessIntent }), true);

const suite = buildProjectMemoryProductionReadinessDiagnosticsSuite({ intent: readinessIntent });
const checks = getProjectMemoryProductionReadinessDiagnosticsChecks();

assert.equal(suite.ok, true);
assert.equal(suite.requested, true);
assert.equal(suite.mode, "read_only");
assert.equal(suite.routing.source, "structured_intent");
assert.equal(suite.routing.keywordMatchingUsed, false);
assert.equal(suite.routing.phraseMatchingUsed, false);
assert.equal(suite.safety.noDbMutation, true);
assert.equal(suite.safety.noProjectMemoryWrite, true);
assert.equal(suite.safety.noConfirmedMemoryWrite, true);
assert.equal(suite.safety.noCandidateConfirmation, true);
assert.equal(suite.safety.noRuntimeFileWrite, true);
assert.equal(suite.safety.noRepositoryMutation, true);
assert.equal(suite.safety.noEnvironmentMutation, true);
assert.equal(suite.safety.noTelegramExecution, true);
assert.equal(suite.safety.noAiExecution, true);
assert.equal(suite.safety.noGitHubFetch, true);
assert.equal(suite.safety.noRenderFetch, true);
assert.equal(suite.safety.noRawLogs, true);
assert.equal(suite.safety.noSecrets, true);

assert.deepEqual(checks, [
  "project_memory_runtime",
  "project_memory_live_db",
  "project_memory_production_readiness",
]);

const plan = buildDiagnosticsPlan({
  text: "language does not decide this route",
  intent: readinessIntent,
});

assert.equal(plan.selectedSuite, PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME);
assert.equal(plan.routing.source, "structured_suite");
assert.equal(plan.routing.keywordMatchingUsed, false);
assert.equal(plan.routing.phraseMatchingUsed, false);
assert.deepEqual(plan.checks, checks);
assert.equal(plan.rules.noWrites, true);
assert.equal(plan.rules.noSecrets, true);
assert.equal(plan.rules.noTransportDependency, true);
assert.equal(plan.rules.noCoreMutation, true);

const capabilityPlan = buildDiagnosticsPlan({
  text: "any user language is allowed here",
  intent: {
    domain: "diagnostics",
    action: "inspect",
    capability: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
  },
});

assert.equal(capabilityPlan.selectedSuite, PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME);
assert.deepEqual(capabilityPlan.checks, checks);

console.log("OK: Project Memory production readiness diagnostics suite routes by structured intent");
