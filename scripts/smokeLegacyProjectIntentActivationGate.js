// scripts/smokeLegacyProjectIntentActivationGate.js
// ============================================================================
// Smoke — Legacy ProjectIntent Activation Gate
//
// Verifies that legacy projectIntent does not influence ordinary chat flow when
// there is no active legacy follow-up/pending-choice state.
//
// Root SG-core natural requests must continue into ordinary Living SG flow
// instead of being answered by legacy snapshot Technical Mode.
// ============================================================================

import assert from "node:assert/strict";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/garya_smoke";

const {
  handleLegacyProjectIntentFlow,
  shouldActivateLegacyProjectIntentFlow,
  LEGACY_PROJECT_INTENT_FLOW_STATUS,
} = await import("../src/core/handleMessage/legacyProjectIntentFlow.js");

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
  false,
  "root SG-core natural requests must not be captured by legacy Technical Mode without active legacy context"
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

const sgCoreMemory = createMemoryStub();
let sgCoreReplyCalls = 0;
const sgCoreRootResult = await handleLegacyProjectIntentFlow({
  trimmed: "Советник, у тебя есть доступ к репозиторию проекта?",
  transport: "telegram",
  chatIdStr: "sg-core-root-chat",
  chatType: "private",
  globalUserId: "monarch-user",
  isPrivateChat: true,
  isMonarchUser: true,
  memory: sgCoreMemory,
  deps: {},
  replyAndLog: async () => {
    sgCoreReplyCalls += 1;
  },
});

assert.equal(sgCoreRootResult.ok, true, "root SG-core legacy bypass must be ok");
assert.equal(sgCoreRootResult.handled, false, "root SG-core request must continue into Living SG flow");
assert.equal(
  sgCoreRootResult.status,
  LEGACY_PROJECT_INTENT_FLOW_STATUS.NOT_HANDLED,
  "root SG-core request must be marked NOT_HANDLED by legacy flow"
);
assert.equal(
  sgCoreRootResult.reason,
  "legacy_project_intent_root_sg_core_inactive_for_living_sg",
  "root SG-core request must be explicitly bypassed for Living SG"
);
assert.equal(sgCoreReplyCalls, 0, "root SG-core bypass must not reply from legacy Technical Mode");
assert.equal(sgCoreMemory.recentCalls, 2, "root SG-core bypass may only read legacy context probes");
assert.equal(
  Object.prototype.hasOwnProperty.call(sgCoreRootResult, "projectMemoryAutoCaptureSummary"),
  false,
  "root SG-core bypass must not run project memory auto-capture"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(sgCoreRootResult, "projectContextDecision"),
  false,
  "root SG-core bypass must not classify project context"
);

console.log("Smoke legacy projectIntent activation gate — OK");
