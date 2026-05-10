// scripts/smokeObservationJournalStatusCheck.js
// SG 2.0 smoke test for Observation Journal Status check.
// Purpose: prove the journal status check returns a bounded read-only shape.

import assert from "node:assert/strict";

import { runObservationJournalStatusCheck } from "../src/diagnostics/observationJournalStatusCheck.js";

const result = await runObservationJournalStatusCheck({
  reportNames: ["diagnostics-latest", "runtime-status-latest"],
});

assert.equal(result.type, "observation_journal_status_check");
assert.equal(result.reports_checked, 2);
assert.equal(Array.isArray(result.reports), true);
assert.equal(result.reports.length, 2);
assert.equal(typeof result.summary, "string");
assert.equal(Object.prototype.hasOwnProperty.call(result, "raw_logs"), false);
assert.equal(Object.prototype.hasOwnProperty.call(result, "raw_provider_ids"), false);

console.log("OK: observation journal status check returns bounded read-only shape");
