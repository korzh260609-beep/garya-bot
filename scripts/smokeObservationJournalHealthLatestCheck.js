// scripts/smokeObservationJournalHealthLatestCheck.js
// SG 2.0 smoke test for Observation Journal Health latest-report diagnostics registry check.
// Purpose: prove the Diagnostics Check Agent can read the journal health latest report through a bounded read-only check.

import assert from "node:assert/strict";

import { runDiagnosticsCheckAgent } from "../src/agents/diagnostics-check-agent/diagnosticsCheckAgent.js";
import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";

const result = await runDiagnosticsCheckAgent({
  checks: ["observation_journal_health_latest"],
  registry: diagnosticsCheckRegistry,
});

assert.equal(result.type, "diagnostics_check_agent_result");
assert.equal(result.checks_requested, 1);
assert.equal(result.checks_executed, 1);
assert.equal(Array.isArray(result.results), true);

const check = result.results[0];

assert.equal(check.type, "observation_journal_health_latest");
assert.equal(typeof check.ok, "boolean");
assert.equal(typeof check.summary, "string");
assert.equal(check.summary.length > 0, true);
assert.equal(check.data.reportName, "observation-journal-health-latest");
assert.equal(check.data.rawPayloadExposed, false);
assert.equal(Object.prototype.hasOwnProperty.call(check.data, "report"), false);
assert.equal(Object.prototype.hasOwnProperty.call(check.data, "events"), false);

console.log(JSON.stringify(result, null, 2));
