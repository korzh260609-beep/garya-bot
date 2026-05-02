// scripts/smokeLegacyProjectIntentActivationGate.js
// ============================================================================
// Smoke — Legacy ProjectIntent Activation Gate
//
// Verifies that legacy projectIntent does not influence ordinary chat flow when
// there is no SG-core route and no active legacy follow-up/pending-choice state.
// ============================================================================

import assert from "node:assert/strict";

import {
  handleLegacyProjectIntentFlow,
  shouldActivateLegacyProjectIntentFlow,
  LEGACY_PROJECT_INTENT_FLOW_STATUS,
} from "../src/core/handleMessage/legacyProjectIntentFlow.js";

function createMemoryStub() {
  let recentCalls = 0;

  return {
    async recent() {
      recentCalls += 1;
      return [];
    },
    async write() {
      throw new Error("ordinary inactive legacy flow must not write memory");
    },
    get recentCalls() {
      return recentCalls;
    },
  };
}

assert.equal(
  shouldActivateLegacyProjectIntentFlow({
    projectIntentRoute: { targetScope: "generic_external" },
    repoFollowupContext: { isActive: false },
    pendingChoiceContext: { isActive: false },
  }),
  false,
  "legacy projectIntent must stay inactive for ordinary non-SG-core messages"
);

assert.equal(
  shouldActivateLegacyProjectIntentFlow({
    projectIntentRoute: { targetScope: "sg_core_internal" },
    repoFollowupContext: { isActive: false },
    pendingChoiceContext: { isActive: false },
  }),
  true,
  "legacy projectIntent may activate for SG-core internal route"
);

assert.equal(
  shouldActivateLegacyProjectIntentFlow({
    projectIntentRoute: { targetScope: "generic_external" },
    repoFollowupContext: { isActive: true },
    pendingChoiceContext: { isActive: false },
  }),
  true,
  "legacy projectIntent may activate for active repo follow-up"
);

assert.equal(
  shouldActivateLegacyProjectIntentFlow({
    projectIntentRoute: { targetScope: "generic_external" },
    repoFollowupContext: { isActive: false },
    pendingChoiceContext: { isActive: true },
  }),
  true,
  "legacy projectIntent may activate for active pending choice"
);

const memory = createMemoryStub();
let replyCalls = 0;

const inactiveResult = await handleLegacyProjectIntentFlow({
  trimmed: "обычное сообщение без работы с проектом",
  transport: "telegram",
  chatIdStr: "ordinary-chat",
  chatType: "private",
  globalUserId: "ordinary-user",
  isPrivateChat: true,
  isMonarchUser: false,
  memory,
  deps: {},
  replyAndLog: async () => {
    replyCalls += 1;
  },
});

assert.equal(inactiveResult.ok, true, "inactive ordinary legacy flow must be ok");
assert.equal(inactiveResult.handled, false, "inactive ordinary legacy flow must not handle message");
assert.equal(
  inactiveResult.status,
  LEGACY_PROJECT_INTENT_FLOW_STATUS.NOT_HANDLED,
  "inactive ordinary legacy flow must return NOT_HANDLED"
);
assert.equal(
  inactiveResult.reason,
  "legacy_project_intent_inactive",
  "inactive ordinary legacy flow must be explicitly marked inactive"
);
assert.equal(
  inactiveResult.diagnosticNaturalBridgeHardBlocked,
  true,
  "diagnostic bridge must remain hard-blocked"
);
assert.equal(replyCalls, 0, "inactive ordinary legacy flow must not reply");
assert.equal(memory.recentCalls, 2, "inactive ordinary legacy flow may only read legacy context probes");
assert.equal(
  Object.prototype.hasOwnProperty.call(inactiveResult, "projectMemoryAutoCaptureSummary"),
  false,
  "inactive ordinary legacy flow must not run project memory auto-capture"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(inactiveResult, "projectContextDecision"),
  false,
  "inactive ordinary legacy flow must not classify project context"
);

console.log("Smoke legacy projectIntent activation gate — OK");
