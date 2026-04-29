// scripts/smokeHumanModeSkeletonImports.js
// ============================================================================
// HUMAN MODE SKELETON IMPORT SMOKE CHECK
//
// Purpose:
// - verify that Human Mode skeleton modules can be imported without syntax or
//   export errors.
// - does not connect Human Mode to runtime.
// - does not call external services.
// ============================================================================

import { handleHumanProjectIntent } from "../src/core/projectIntent/modes/human/projectIntentHumanEntry.js";
import { checkHumanProjectIntentPermissions } from "../src/core/projectIntent/modes/human/projectIntentHumanPermissions.js";
import { classifyHumanProjectIntentMeaning } from "../src/core/projectIntent/modes/human/projectIntentHumanMeaning.js";
import { loadHumanProjectRepoFacts } from "../src/core/projectIntent/modes/human/projectIntentHumanRepoFacts.js";
import { selectHumanProjectCapability } from "../src/core/projectIntent/modes/human/projectIntentHumanCapabilitySelector.js";
import { buildHumanProjectIntentResponse } from "../src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js";

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Human Mode skeleton smoke check failed: ${name} is not a function`);
  }
}

assertFunction("handleHumanProjectIntent", handleHumanProjectIntent);
assertFunction("checkHumanProjectIntentPermissions", checkHumanProjectIntentPermissions);
assertFunction("classifyHumanProjectIntentMeaning", classifyHumanProjectIntentMeaning);
assertFunction("loadHumanProjectRepoFacts", loadHumanProjectRepoFacts);
assertFunction("selectHumanProjectCapability", selectHumanProjectCapability);
assertFunction("buildHumanProjectIntentResponse", buildHumanProjectIntentResponse);

const denied = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: false,
  isPrivateChat: false,
});

if (denied?.mode !== "human") {
  throw new Error("Human Mode skeleton smoke check failed: expected mode=human");
}

if (denied?.blocked !== true) {
  throw new Error("Human Mode skeleton smoke check failed: expected denied skeleton call to be blocked");
}

const allowed = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: true,
  isPrivateChat: true,
});

if (allowed?.mode !== "human") {
  throw new Error("Human Mode skeleton smoke check failed: expected allowed mode=human");
}

if (allowed?.allowed !== true) {
  throw new Error("Human Mode skeleton smoke check failed: expected allowed skeleton call to be allowed");
}

if (allowed?.handled !== false) {
  throw new Error("Human Mode skeleton smoke check failed: skeleton must not handle runtime yet");
}

console.log("OK: Human Mode skeleton imports and basic skeleton contract are valid.");
