// scripts/smokeProjectMemoryEntryLookupCheck.js
// SG 2.0 — Project Memory entry lookup diagnostics smoke.
// Deterministic/offline: no real DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";
import { runProjectMemoryEntryLookupCheck } from "../src/diagnostics/projectMemoryEntryLookupCheck.js";

const invalid = await runProjectMemoryEntryLookupCheck({ prNumber: "abc", databaseConfigured: true });
assert.equal(invalid.ok, false);
assert.equal(invalid.type, "project_memory_entry_lookup_check");
assert.equal(invalid.readOnly, true);
assert.equal(invalid.sanitized, true);
assert.equal(invalid.warnings[0].code, "missing_valid_pr_number");

const noDb = await runProjectMemoryEntryLookupCheck({ prNumber: 319, databaseConfigured: false });
assert.equal(noDb.ok, false);
assert.equal(noDb.details.prNumber, 319);
assert.equal(noDb.details.checked, false);
assert.equal(noDb.warnings[0].code, "database_not_configured");

const notFound = await runProjectMemoryEntryLookupCheck({
  prNumber: 319,
  databaseConfigured: true,
  queryFn: async () => ({ ok: true, rows: [], rowCount: 0 }),
});
assert.equal(notFound.ok, false);
assert.equal(notFound.details.found, false);
assert.equal(notFound.details.confirmedActiveFound, false);
assert.equal(notFound.warnings[0].code, "project_memory_entry_not_found");

const candidate = await runProjectMemoryEntryLookupCheck({
  prNumber: 319,
  databaseConfigured: true,
  queryFn: async () => ({
    ok: true,
    rows: [{
      id: "pm_candidate",
      project_key: "sg",
      title: "PR #319 merged — test",
      trust: "candidate",
      status: "pending_confirmation",
      source_type: "github_pr_merged",
      source_ref: "https://github.com/korzh260609-beep/garya-bot/pull/319",
      trace_id: "pmtrace_319",
      metadata: { prNumber: 319 },
      confirmed_by: null,
      confirmed_at: null,
      created_at: "2026-05-22T00:00:00.000Z",
      updated_at: "2026-05-22T00:00:00.000Z",
    }],
    rowCount: 1,
  }),
});
assert.equal(candidate.ok, false);
assert.equal(candidate.details.found, true);
assert.equal(candidate.details.confirmedActiveFound, false);
assert.equal(candidate.details.entries[0].trust, "candidate");
assert.equal(candidate.warnings[0].code, "project_memory_entry_found_but_not_confirmed_active");

const confirmed = await runProjectMemoryEntryLookupCheck({
  prNumber: 319,
  databaseConfigured: true,
  queryFn: async () => ({
    ok: true,
    rows: [{
      id: "pm_confirmed",
      project_key: "sg",
      title: "PR #319 merged — test",
      trust: "confirmed",
      status: "active",
      source_type: "github_pr_merged",
      source_ref: "https://github.com/korzh260609-beep/garya-bot/pull/319",
      trace_id: "pmtrace_319",
      metadata: { prNumber: 319 },
      confirmed_by: "system",
      confirmed_at: "2026-05-22T00:01:00.000Z",
      created_at: "2026-05-22T00:00:00.000Z",
      updated_at: "2026-05-22T00:01:00.000Z",
    }],
    rowCount: 1,
  }),
});
assert.equal(confirmed.ok, true);
assert.equal(confirmed.details.found, true);
assert.equal(confirmed.details.confirmedActiveFound, true);
assert.equal(confirmed.details.entries[0].trust, "confirmed");
assert.equal(confirmed.warnings.length, 0);

const registered = diagnosticsCheckRegistry.find((check) => check.name === "project_memory_entry_lookup");
assert.ok(registered);
const registryResult = await registered.run({ prNumber: 319, limit: 5 });
assert.equal(registryResult.type, "project_memory_entry_lookup_check");
assert.equal(typeof registered.summarize(registryResult), "string");

console.log("smokeProjectMemoryEntryLookupCheck: ok");
