// scripts/smokeLivingSGCoreBehavior.js
// ============================================================================
// LIVING SG CORE BEHAVIOR SMOKE CHECK
//
// Purpose:
// - verify that Living SG behavior is part of BehaviorCore;
// - verify that Living SG is a global behavior policy, not a repo/tool shortcut;
// - does not call AI;
// - does not read or write repo/runtime state;
// - does not connect capabilities.
// ============================================================================

import {
  getBehaviorCore,
  buildBehaviorCorePromptBlock,
} from "../src/core/behaviorCore.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG core behavior smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(name, value, expectedPart) {
  const text = String(value || "");
  if (!text.includes(expectedPart)) {
    throw new Error(`Living SG core behavior smoke check failed: ${name}: missing ${expectedPart}`);
  }
}

function assertNotIncludes(name, value, forbiddenPart) {
  const text = String(value || "");
  if (text.includes(forbiddenPart)) {
    throw new Error(`Living SG core behavior smoke check failed: ${name}: forbidden ${forbiddenPart}`);
  }
}

const core = getBehaviorCore({
  text: "что мы сейчас делаем по живому слою СГ?",
});

assertEqual("core.livingSG", core.livingSG, true);
assertEqual("core.supportsLivingSG", core.supportsLivingSG, true);
assertIncludes("core.version", core.version, "living-sg-core");
assertIncludes("core.version", core.version, "v2");
assertEqual("core.behaviorIndependentFromAnswerMode", core.behaviorIndependentFromAnswerMode, true);

const promptBlock = buildBehaviorCorePromptBlock({
  text: "что мы сейчас делаем по живому слою СГ?",
});

assertIncludes("promptBlock", promptBlock, "LIVING SG:");
assertIncludes("promptBlock", promptBlock, "global Advisor system");
assertIncludes("promptBlock", promptBlock, "not a command bot");
assertIncludes("promptBlock", promptBlock, "conversation context");
assertIncludes("promptBlock", promptBlock, "available sources");
assertIncludes("promptBlock", promptBlock, "state-changing actions require explicit permission");
assertIncludes("promptBlock", promptBlock, "keyword or phrase matching as primary intelligence");
assertIncludes("promptBlock", promptBlock, "weak hints only");
assertIncludes("promptBlock", promptBlock, "do not expand Technical Mode behavior from Living SG behavior");
assertIncludes("promptBlock", promptBlock, "Human Mode primary");
assertIncludes("promptBlock", promptBlock, "must not act as separate SG entities");

assertNotIncludes("promptBlock", promptBlock, "repo.read = true");
assertNotIncludes("promptBlock", promptBlock, "execute RepoStateAgent");
assertNotIncludes("promptBlock", promptBlock, "commit automatically");

console.log("OK: Living SG core behavior policy is present and does not connect capabilities.");
