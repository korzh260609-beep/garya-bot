// scripts/smokeObservationLatestReportCheck.js
// SG 2.0 smoke test for Observation latest-report diagnostic check.
// Purpose: prove the diagnostic returns a safe public shape even when the latest report is unavailable.

import assert from "node:assert/strict";

import { runObservationLatestReportCheck } from "../src/diagnostics/observationLatestReportCheck.js";

const result = await runObservationLatestReportCheck({
  name: "smoke-nonexistent-observation-report",
});

assert.equal(result.type, "observation_latest_report");
assert.equal(result.reportName, "smoke-nonexistent-observation-report");
assert.equal(result.rawPayloadExposed, false);
assert.equal(Object.prototype.hasOwnProperty.call(result, "report"), false);
assert.equal(Object.prototype.hasOwnProperty.call(result, "events"), false);
assert.equal(typeof result.summary, "string");
assert.equal(result.summary.length > 0, true);

console.log(JSON.stringify(result, null, 2));
