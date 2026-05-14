// scripts/smokeMigrationGovernanceRegistry.js
// SG 2.0 smoke test for migration governance diagnostics registry wiring.

import assert from "node:assert/strict";

import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";

const check = diagnosticsCheckRegistry.find((item) => item.name === "migration_governance");

assert.equal(Boolean(check), true);
assert.equal(typeof check.run, "function");
assert.equal(typeof check.summarize, "function");

const result = await check.run({});
const summary = check.summarize(result);

assert.equal(result.ok, true);
assert.equal(result.type, "diagnostics_check");
assert.equal(result.name, "migration_governance");
assert.equal(result.willMutateDatabase, false);
assert.equal(result.executionAllowed, false);
assert.equal(result.safety.noDbMutation, true);
assert.equal(result.safety.executionBlocked, true);
assert.equal(typeof summary, "string");
assert.equal(summary.length > 0, true);

console.log("OK: migration governance diagnostics registry wiring is read-only and blocked");
