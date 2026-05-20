// scripts/smokeProjectMemoryCountsCheck.js
// SG 2.0 — Project Memory counts diagnostics smoke.
// No DB mutation, no Project Memory writes, no AI, no Telegram.

import assert from "node:assert/strict";
import { runProjectMemoryCountsCheck } from "../src/diagnostics/projectMemoryCountsCheck.js";

let queryCalled = 0;
const queryFn = async (sql) => {
  queryCalled += 1;
  assert.equal(sql.includes("SELECT project_key, trust, status, COUNT(*)::int AS count"), true);
  assert.equal(sql.includes("GROUP BY project_key, trust, status"), true);
  assert.equal(sql.includes("INSERT"), false);
  assert.equal(sql.includes("UPDATE"), false);
  assert.equal(sql.includes("DELETE"), false);
  return {
    ok: true,
    rowCount: 4,
    rows: [
      { project_key: "sg", trust: "confirmed", status: "active", count: 3 },
      { project_key: "sg", trust: "candidate", status: "pending_confirmation", count: 2 },
      { project_key: "sg", trust: "confirmed", status: "archived", count: 1 },
      { project_key: "user_project:demo", trust: "confirmed", status: "active", count: 5 },
    ],
  };
};

const result = await runProjectMemoryCountsCheck({ queryFn, databaseConfigured: true });

assert.equal(queryCalled, 1);
assert.equal(result.ok, true);
assert.equal(result.type, "project_memory_counts_check");
assert.equal(result.readOnly, true);
assert.equal(result.sanitized, true);
assert.equal(result.details.databaseConfigured, true);
assert.equal(result.details.checked, true);
assert.equal(result.details.totalEntries, 11);
assert.equal(result.details.sgConfirmedActiveCount, 3);
assert.equal(result.details.sgPendingCandidateCount, 2);
assert.deepEqual(result.warnings, []);
assert.equal(result.summary.includes("total=11"), true);
assert.equal(result.summary.includes("sg_confirmed_active=3"), true);

const emptyConfirmed = await runProjectMemoryCountsCheck({
  databaseConfigured: true,
  queryFn: async () => ({
    ok: true,
    rowCount: 1,
    rows: [
      { project_key: "sg", trust: "candidate", status: "pending_confirmation", count: 7 },
    ],
  }),
});

assert.equal(emptyConfirmed.ok, true);
assert.equal(emptyConfirmed.details.totalEntries, 7);
assert.equal(emptyConfirmed.details.sgConfirmedActiveCount, 0);
assert.equal(emptyConfirmed.details.sgPendingCandidateCount, 7);
assert.equal(emptyConfirmed.warnings.length, 1);
assert.equal(emptyConfirmed.warnings[0].code, "project_memory_sg_confirmed_active_empty");

const noDatabase = await runProjectMemoryCountsCheck({ databaseConfigured: false });
assert.equal(noDatabase.ok, false);
assert.equal(noDatabase.details.databaseConfigured, false);
assert.equal(noDatabase.warnings[0].code, "database_not_configured");

console.log("smokeProjectMemoryCountsCheck: ok");
