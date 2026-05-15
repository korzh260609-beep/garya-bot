// scripts/smokeMigrationGovernanceDiagnosticsRoute.js
// SG 2.0 smoke test for structured migration_governance diagnostics route.

import assert from "node:assert/strict";

import {
  detectExplicitDiagnosticsCheckRequest,
  handleMessageDiagnosticsRoute,
} from "../src/core/message/messageDiagnosticsRoute.js";

const text = "СГ migration_governance";
const structuredIntent = {
  domain: "diagnostics",
  action: "inspect",
  checks: ["migration_governance"],
};

const plainTextDetection = detectExplicitDiagnosticsCheckRequest({ text });

assert.equal(plainTextDetection.ok, false);
assert.equal(plainTextDetection.reason, "no_structured_intent");
assert.deepEqual(plainTextDetection.checks, []);
assert.equal(plainTextDetection.routing.keywordMatchingUsed, false);
assert.equal(plainTextDetection.routing.phraseMatchingUsed, false);

const detection = detectExplicitDiagnosticsCheckRequest({
  text,
  intent: structuredIntent,
});

assert.equal(detection.ok, true);
assert.equal(detection.reason, "structured_diagnostics_intent_matched");
assert.deepEqual(detection.checks, ["migration_governance"]);
assert.equal(detection.routing.keywordMatchingUsed, false);
assert.equal(detection.routing.phraseMatchingUsed, false);

const noMatch = detectExplicitDiagnosticsCheckRequest({
  text: "СГ проверь миграции",
});

assert.equal(noMatch.ok, false);
assert.equal(noMatch.reason, "no_structured_intent");
assert.deepEqual(noMatch.checks, []);

let called = false;

const route = await handleMessageDiagnosticsRoute({
  text,
  intent: structuredIntent,
  identity: {
    isMonarch: true,
    role: "monarch",
  },
  runDiagnosticsCheckFn: async (input, context) => {
    called = true;

    assert.deepEqual(input.checks, ["migration_governance"]);
    assert.equal(input.text, text);
    assert.equal(input.intent.domain, "diagnostics");
    assert.deepEqual(input.intent.checks, ["migration_governance"]);
    assert.equal(context.isMonarch, true);
    assert.equal(context.latestUserText, text);
    assert.equal(context.intent.domain, "diagnostics");

    return {
      ok: true,
      type: "sg_diagnostics_check",
      plan: {
        routing: {
          source: "structured_intent_checks",
          keywordMatchingUsed: false,
          phraseMatchingUsed: false,
        },
      },
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
assert.equal(route.diagnosticsRoute.intent.domain, "diagnostics");
assert.equal(route.diagnosticsRoute.routing.keywordMatchingUsed, false);
assert.equal(route.diagnosticsRoute.routing.phraseMatchingUsed, false);
assert.equal(route.diagnosticsRoute.resultType, "sg_diagnostics_check");

const denied = await handleMessageDiagnosticsRoute({
  text,
  intent: structuredIntent,
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

console.log("OK: structured migration_governance diagnostics route is intent-based and AI-free");
