import assert from "node:assert/strict";

import { buildDiagnosticsCommandBridgeIntent } from "../src/core/message/messageDiagnosticsCommandBridge.js";
import { handleMessageDiagnosticsRoute } from "../src/core/message/messageDiagnosticsRoute.js";

const CHECK_NAME = "project_memory_entry_lookup";
const text = "СГ, выполни project_memory_entry_lookup для PR #321";

const bridged = buildDiagnosticsCommandBridgeIntent({ text });

assert.equal(bridged.changed, true);
assert.equal(bridged.matchedCheck, CHECK_NAME);
assert.equal(bridged.intent.domain, "diagnostics");
assert.equal(bridged.intent.action, "inspect");
assert.deepEqual(bridged.intent.checks, [CHECK_NAME]);

let capturedInput = null;
let capturedContext = null;

const routeResult = await handleMessageDiagnosticsRoute({
  text,
  identity: {
    isMonarch: true,
    role: "monarch",
    globalUserId: "sg_monarch_smoke",
  },
  intent: bridged.intent,
  context: {
    intent: bridged.intent,
  },
  runDiagnosticsCheckFn: async (input, context) => {
    capturedInput = input;
    capturedContext = context;

    return {
      ok: true,
      type: "sg_diagnostics_check",
      finalText: "Project Memory entry lookup smoke result",
      plan: {
        routing: {
          source: "explicit_checks",
          keywordMatchingUsed: false,
          phraseMatchingUsed: false,
        },
      },
    };
  },
});

assert.equal(routeResult.handled, true);
assert.equal(routeResult.ok, true);
assert.equal(routeResult.reply, "Project Memory entry lookup smoke result");
assert.deepEqual(capturedInput.checks, [CHECK_NAME]);
assert.equal(capturedInput.text, text);
assert.equal(capturedContext.isMonarch, true);
assert.deepEqual(capturedContext.intent.checks, [CHECK_NAME]);

const unchanged = buildDiagnosticsCommandBridgeIntent({
  text,
  intent: {
    domain: "diagnostics",
    action: "inspect",
    checks: [CHECK_NAME],
  },
});

assert.equal(unchanged.changed, false);
assert.equal(unchanged.source, "existing_structured_intent");
assert.deepEqual(unchanged.intent.checks, [CHECK_NAME]);

console.log("smokeMessageDiagnosticsCommandBridge: ok");
