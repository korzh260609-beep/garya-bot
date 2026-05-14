// scripts/smokeProjectMemoryLiveDbCheck.js
// SG 2.0 smoke test for Project Memory live DB diagnostics check.
// Purpose: prove the check is read-only, sanitized, and handles missing DATABASE_URL safely.

import assert from "node:assert/strict";

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

const { runProjectMemoryLiveDbCheck } = await import("../src/diagnostics/projectMemoryLiveDbCheck.js");
const { diagnosticsCheckRegistry } = await import("../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js");

const result = await runProjectMemoryLiveDbCheck();

assert.equal(result.ok, false);
assert.equal(result.type, "project_memory_live_db_check");
assert.equal(result.sanitized, true);
assert.equal(result.readOnly, true);
assert.equal(result.details.databaseConfigured, false);
assert.equal(result.details.checked, false);
assert.equal(Array.isArray(result.details.expectedTables), true);
assert.equal(result.details.expectedTables.includes("sg_project_memory_entries"), true);
assert.equal(result.details.expectedTables.includes("sg_project_memory_write_audit"), true);
assert.equal(Array.isArray(result.warnings), true);
assert.equal(result.warnings[0].code, "database_not_configured");

const registered = diagnosticsCheckRegistry.find((check) => check.name === "project_memory_live_db");
assert.ok(registered);
assert.equal(typeof registered.run, "function");
assert.equal(typeof registered.summarize, "function");
assert.equal(registered.summarize(result), result.summary);

if (originalDatabaseUrl === undefined) {
  delete process.env.DATABASE_URL;
} else {
  process.env.DATABASE_URL = originalDatabaseUrl;
}

console.log("OK: Project Memory live DB diagnostics check is read-only and safely handles missing DATABASE_URL");
