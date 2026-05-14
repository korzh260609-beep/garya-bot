// scripts/smokeMigrationGovernanceDiagnosticsRoute.js
// SG 2.0 smoke test for explicit migration_governance diagnostics route.

import assert from "node:assert/strict";

import {
  detectExplicitDiagnosticsCheckRequest,
  handleMessageDiagnosticsRoute,
} from "../src/core/message/messageDiagnosticsRoute.js";

const text = "СГ, выполни диагностику migration_governance";

const detection = detectExplicitDiagnosticsCheckRequest({ text });

assert.equal(detection.ok, true);
assert.equal(detection.reason, "explicit_diagnostics_check_matched");
assert.deepEqual(detection.checks, ["migration_governance"]);

let called = false;

const route = await handleMessageDiagnosticsRoute({
  text,
  identity: {
    isMonarch: true,
    role: "monarch",
  },
  runDiagnosticsCheckFn: async (input, context) => {
    called = true;

    assert.deepEqual(input.checks, ["migration_governance"]);
    assert.equal(input.text, text);
    assert.equal(context.isMonarch, true);
    assert.equal(context.latestUserText, text);

    return {
      ok: true,
      type: "sg_diagnostics_check",
      finalText: "Диагностика SG выполнена. migration_governance OK.",
    };
  },
});

assert.equal(called, true);
assert.equal(route.handled, true);
assert.equal(route.ok, true);
assert.equal(route.reply.includes("migration_governance OK"), true);
assert.equal(route.diagnosticsRoute.handled, true);
assert.deepEqual(route.diagnosticsRoute.checks, ["migration_governance"]);
assert.equal(route.diagnosticsRoute.resultType, "sg_diagnostics_check");

const denied = await handleMessageDiagnosticsRoute({
  text,
  identity: {
    isMonarch: false,
    role: "guest",
  },
  runDiagnosticsCheckFn: async () => {
    throw new Error("must_not_run_for_non_monarch");
  },
});

assert.equal(denied.handled, true);
assert.equal(denied.ok, false);
assert.equal(denied.diagnosticsRoute.reason, "not_monarch");
assert.equal(denied.reply, "Диагностика доступна только монарху.");

console.log("OK: explicit migration_governance diagnostics route is deterministic and AI-free");
