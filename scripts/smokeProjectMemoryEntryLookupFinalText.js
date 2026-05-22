import assert from "node:assert/strict";

import { runDiagnosticsCheck } from "../src/diagnostics/diagnosticsRunner.js";

const result = await runDiagnosticsCheck({
  text: "СГ, выполни project_memory_entry_lookup для PR #321",
  intent: {
    domain: "diagnostics",
    action: "inspect",
    checks: ["project_memory_entry_lookup"],
  },
  checks: ["project_memory_entry_lookup"],
}, {
  isMonarch: true,
  skipDiagnosticsObservation: true,
  runDiagnosticsChecksFn: async () => [
    {
      ok: false,
      type: "project_memory_entry_lookup",
      summary: "Project Memory entry lookup for PR #321: no exact entries found, near_matches=1.",
      data: {
        ok: false,
        type: "project_memory_entry_lookup_check",
        version: 2,
        summary: "Project Memory entry lookup for PR #321: no exact entries found, near_matches=1.",
        details: {
          databaseConfigured: true,
          checked: true,
          requestedPrNumber: 321,
          prNumber: 321,
          found: false,
          confirmedActiveFound: false,
          queryPatternsApplied: {
            exactPatternsApplied: [
              { key: "source_ref:/pull/{prNumber}", field: "source_ref" },
              { key: "title:PR #{prNumber}", field: "title" },
              { key: "metadata.prNumber", field: "metadata->>'prNumber'" },
            ],
            nearPatternsApplied: [
              { key: "near:source_ref contains {prNumber}", field: "source_ref" },
              { key: "near:metadata text contains {prNumber}", field: "metadata::text" },
            ],
          },
          exactMatches: [],
          nearMatches: [
            {
              id: "pm_near",
              projectKey: "sg",
              title: "Merged pull request 321",
              trust: "candidate",
              status: "pending_confirmation",
              sourceType: "pr",
              sourceRef: "github.pr_merged:321",
              traceId: "pmtrace_near_321",
              confirmedAt: null,
              metadataKeys: ["pr_number", "pullRequest"],
              metadataShape: {
                pr_number: "number",
                pullRequest: {
                  number: "number",
                },
              },
            },
          ],
          entries: [],
        },
        warnings: [],
        sanitized: true,
        readOnly: true,
      },
    },
  ],
});

assert.equal(result.ok, false);
assert.match(result.finalText, /requestedPrNumber: 321/);
assert.match(result.finalText, /databaseConfigured: true/);
assert.match(result.finalText, /exactMatches: 0/);
assert.match(result.finalText, /nearMatches: 1/);
assert.match(result.finalText, /exactPatterns:/);
assert.match(result.finalText, /nearPatterns:/);
assert.match(result.finalText, /firstExactMatch: none/);
assert.match(result.finalText, /firstNearMatch:/);
assert.match(result.finalText, /metadataKeys: pr_number, pullRequest/);
assert.match(result.finalText, /metadataShape:/);

console.log("smokeProjectMemoryEntryLookupFinalText: ok");
