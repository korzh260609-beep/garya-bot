// scripts/smokeDiagnosticsExplicitCheckRoute.js
// SG 2.0 smoke test for explicit diagnostics check routing.
// Purpose: prove ordinary Monarch text can select one allowlisted diagnostics check before AI.

import assert from "node:assert/strict";

import {
  detectExplicitDiagnosticsCheckRequest,
  handleMessageDiagnosticsRoute,
} from "../src/core/message/messageDiagnosticsRoute.js";

const text = "СГ, выполни диагностику project_memory_live_db";

const detection = detectExplicitDiagnosticsCheckRequest({ text });

assert.equal(detection.ok, true);
assert.deepEqual(detection.checks, ["project_memory_live_db"]);

let called = 0;
let receivedChecks = null;

const result = await handleMessageDiagnosticsRoute({
  text,
  identity: {
    isMonarch: true,
    role: "monarch",
    globalUserId: "usr_48cc07c069030fb3",
  },
  runDiagnosticsCheckFn: async (input) => {
    called += 1;
    receivedChecks = input.checks;

    return {
      ok: true,
      type: "sg_diagnostics_check",
      finalText: "Диагностика SG выполнена.",
    };
  },
});

assert.equal(result.handled, true);
assert.equal(result.ok, true);
assert.equal(called, 1);
assert.deepEqual(receivedChecks, ["project_memory_live_db"]);
assert.equal(result.diagnosticsRoute.handled, true);
assert.deepEqual(result.diagnosticsRoute.checks, ["project_memory_live_db"]);
assert.match(result.reply, /Диагностика SG выполнена/);

const normalMessage = await handleMessageDiagnosticsRoute({
  text: "СГ, привет",
  identity: {
    isMonarch: true,
  },
  runDiagnosticsCheckFn: async () => {
    throw new Error("must_not_call_diagnostics_for_normal_text");
  },
});

assert.equal(normalMessage.handled, false);

const nonMonarch = await handleMessageDiagnosticsRoute({
  text,
  identity: {
    isMonarch: false,
  },
  runDiagnosticsCheckFn: async () => {
    throw new Error("must_not_call_diagnostics_for_non_monarch");
  },
});

assert.equal(nonMonarch.handled, true);
assert.equal(nonMonarch.ok, false);
assert.match(nonMonarch.reply, /только монарху/i);

console.log("OK: explicit diagnostics check route selects only project_memory_live_db before AI");
