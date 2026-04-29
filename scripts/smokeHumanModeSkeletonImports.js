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
import {
  classifyHumanProjectIntentMeaning,
  HUMAN_PROJECT_INTENT_KINDS,
} from "../src/core/projectIntent/modes/human/projectIntentHumanMeaning.js";
import {
  buildHumanProjectRepoFactsFromRepoStateAgentResult,
  loadHumanProjectRepoFacts,
} from "../src/core/projectIntent/modes/human/projectIntentHumanRepoFacts.js";
import {
  HUMAN_PROJECT_CAPABILITIES,
  selectHumanProjectCapability,
} from "../src/core/projectIntent/modes/human/projectIntentHumanCapabilitySelector.js";
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
assertFunction(
  "buildHumanProjectRepoFactsFromRepoStateAgentResult",
  buildHumanProjectRepoFactsFromRepoStateAgentResult
);
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

const missingRepoFacts = loadHumanProjectRepoFacts();

if (missingRepoFacts?.ok !== false) {
  throw new Error("Human Mode skeleton smoke check failed: missing repo facts must be ok=false");
}

if (missingRepoFacts?.reason !== "repo_state_agent_result_not_provided") {
  throw new Error("Human Mode skeleton smoke check failed: unexpected missing repo facts reason");
}

const capabilityWithoutFacts = selectHumanProjectCapability({
  meaning: {
    intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
  },
  repoFacts: missingRepoFacts,
});

if (capabilityWithoutFacts?.capability !== HUMAN_PROJECT_CAPABILITIES.NONE) {
  throw new Error("Human Mode skeleton smoke check failed: capability without repo facts must be none");
}

const sampleRepoFacts = buildHumanProjectRepoFactsFromRepoStateAgentResult({
  repoFullName: "korzh260609-beep/garya-bot",
  branch: "main",
  filesCount: 10,
  modulesCount: 2,
  dependenciesCount: 3,
  projectMap: {
    repo: {
      fullName: "korzh260609-beep/garya-bot",
      branch: "main",
    },
    totals: {
      files: 10,
      modules: 2,
      dependencies: 3,
    },
  },
});

if (sampleRepoFacts?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: sample repo facts must be ok=true");
}

if (sampleRepoFacts?.facts?.repo?.fullName !== "korzh260609-beep/garya-bot") {
  throw new Error("Human Mode skeleton smoke check failed: sample repo facts repo fullName mismatch");
}

const architectureCapability = selectHumanProjectCapability({
  meaning: {
    intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
  },
  repoFacts: sampleRepoFacts,
});

if (architectureCapability?.capability !== HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE) {
  throw new Error("Human Mode skeleton smoke check failed: architecture capability mismatch");
}

const riskCapability = selectHumanProjectCapability({
  meaning: {
    intentKind: HUMAN_PROJECT_INTENT_KINDS.RISK_QUESTION,
  },
  repoFacts: sampleRepoFacts,
});

if (riskCapability?.capability !== HUMAN_PROJECT_CAPABILITIES.IDENTIFY_RISK) {
  throw new Error("Human Mode skeleton smoke check failed: risk capability mismatch");
}

console.log("OK: Human Mode skeleton imports and basic skeleton contract are valid.");
