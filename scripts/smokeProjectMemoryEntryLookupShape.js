import assert from "node:assert/strict";

import { runProjectMemoryEntryLookupCheck } from "../src/diagnostics/projectMemoryEntryLookupCheck.js";

const rows = [
  {
    id: "pm_exact",
    project_key: "sg",
    title: "PR #321 merged — Test exact",
    trust: "confirmed",
    status: "active",
    source_type: "pr",
    source_ref: "https://github.com/korzh260609-beep/garya-bot/pull/321",
    trace_id: "pmtrace_exact_321",
    metadata: {
      prNumber: 321,
      github: {
        prNumber: 321,
      },
      source: {
        kind: "github_pr_merged",
      },
    },
    confirmed_by: "sg_monarch",
    confirmed_at: "2026-05-22T00:00:00.000Z",
    created_at: "2026-05-22T00:00:00.000Z",
    updated_at: "2026-05-22T00:00:00.000Z",
  },
];

const nearOnlyRows = [
  {
    id: "pm_near",
    project_key: "user_project",
    title: "Merged pull request 321",
    trust: "candidate",
    status: "pending_confirmation",
    source_type: "pr",
    source_ref: "github.pr_merged:321",
    trace_id: "pmtrace_near_321",
    metadata: {
      pr_number: 321,
      pullRequest: {
        number: 321,
      },
    },
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-05-22T00:00:00.000Z",
    updated_at: "2026-05-22T00:00:00.000Z",
  },
];

const calls = [];

const exactResult = await runProjectMemoryEntryLookupCheck({
  prNumber: 321,
  databaseConfigured: true,
  queryFn: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("project_key = 'sg'")) {
      return { ok: true, rows, rowCount: rows.length };
    }
    return { ok: true, rows: nearOnlyRows, rowCount: nearOnlyRows.length };
  },
});

assert.equal(exactResult.version, 2);
assert.equal(exactResult.ok, true);
assert.equal(exactResult.readOnly, true);
assert.equal(exactResult.sanitized, true);
assert.equal(exactResult.details.requestedPrNumber, 321);
assert.equal(exactResult.details.found, true);
assert.equal(exactResult.details.confirmedActiveFound, true);
assert.equal(exactResult.details.exactMatches.length, 1);
assert.equal(exactResult.details.nearMatches.length, 1);
assert.equal(exactResult.details.exactMatches[0].metadataKeys.includes("prNumber"), true);
assert.equal(exactResult.details.exactMatches[0].metadataShape.github.prNumber, "number");
assert.equal(Array.isArray(exactResult.details.queryPatternsApplied.exactPatternsApplied), true);
assert.equal(Array.isArray(exactResult.details.queryPatternsApplied.nearPatternsApplied), true);
assert.equal(calls.length, 2);

const nearOnlyResult = await runProjectMemoryEntryLookupCheck({
  prNumber: 321,
  databaseConfigured: true,
  queryFn: async (sql) => {
    if (sql.includes("project_key = 'sg'")) {
      return { ok: true, rows: [], rowCount: 0 };
    }
    return { ok: true, rows: nearOnlyRows, rowCount: nearOnlyRows.length };
  },
});

assert.equal(nearOnlyResult.ok, false);
assert.equal(nearOnlyResult.details.found, false);
assert.equal(nearOnlyResult.details.exactMatches.length, 0);
assert.equal(nearOnlyResult.details.nearMatches.length, 1);
assert.equal(
  nearOnlyResult.warnings.some((item) => item.code === "project_memory_entry_near_matches_found"),
  true,
);

const missingPrResult = await runProjectMemoryEntryLookupCheck({
  prNumber: null,
  databaseConfigured: true,
});

assert.equal(missingPrResult.ok, false);
assert.equal(missingPrResult.details.requestedPrNumber, null);
assert.equal(missingPrResult.details.queryPatternsApplied.requestedPrNumber, "unknown");

console.log("smokeProjectMemoryEntryLookupShape: ok");
