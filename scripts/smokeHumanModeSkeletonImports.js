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

const rawTextMeaning = classifyHumanProjectIntentMeaning({
  text: "проверь архитектуру проекта",
});

if (rawTextMeaning?.intentKind !== HUMAN_PROJECT_INTENT_KINDS.UNKNOWN) {
  throw new Error("Human Mode skeleton smoke check failed: raw text must not be classified yet");
}

const structuredMeaning = classifyHumanProjectIntentMeaning({
  context: {
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "test",
    },
  },
});

if (structuredMeaning?.intentKind !== HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION) {
  throw new Error("Human Mode skeleton smoke check failed: structured meaning was not accepted");
}

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
  throw new Error("Human Mode skeleton smoke check failed: skeleton must not handle runtime yet without repo facts");
}

const missingRepoFacts = await loadHumanProjectRepoFacts();

if (missingRepoFacts?.ok !== false) {
  throw new Error("Human Mode skeleton smoke check failed: missing repo facts must be ok=false");
}

if (missingRepoFacts?.reason !== "repo_state_agent_result_not_provided") {
  throw new Error("Human Mode skeleton smoke check failed: unexpected missing repo facts reason");
}

const blockedRunnerFacts = await loadHumanProjectRepoFacts({
  context: {
    repoStateAgentRunner: async () => {
      throw new Error("repoStateAgentRunner must not be called without allowHumanRepoStateAgentRun=true");
    },
  },
});

if (blockedRunnerFacts?.reason !== "repo_state_agent_runner_present_but_not_allowed") {
  throw new Error("Human Mode skeleton smoke check failed: injected runner must be blocked by default");
}

const responseWithoutFacts = buildHumanProjectIntentResponse({
  repoFacts: missingRepoFacts,
  capability: {
    ready: true,
    capability: HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE,
  },
});

if (responseWithoutFacts?.ok !== false) {
  throw new Error("Human Mode skeleton smoke check failed: response without repo facts must be ok=false");
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

const sampleRepoStateAgentResult = {
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
};

const sampleRepoFacts = buildHumanProjectRepoFactsFromRepoStateAgentResult(sampleRepoStateAgentResult);

if (sampleRepoFacts?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: sample repo facts must be ok=true");
}

if (sampleRepoFacts?.facts?.repo?.fullName !== "korzh260609-beep/garya-bot") {
  throw new Error("Human Mode skeleton smoke check failed: sample repo facts repo fullName mismatch");
}

let injectedRunnerCallCount = 0;
const allowedRunnerFacts = await loadHumanProjectRepoFacts({
  context: {
    allowHumanRepoStateAgentRun: true,
    repoStateAgentRunner: async (runnerContext) => {
      injectedRunnerCallCount += 1;

      if (runnerContext?.mode !== "human") {
        throw new Error("Human Mode skeleton smoke check failed: injected runner mode mismatch");
      }

      return sampleRepoStateAgentResult;
    },
  },
});

if (injectedRunnerCallCount !== 1) {
  throw new Error("Human Mode skeleton smoke check failed: injected runner must be called exactly once when allowed");
}

if (allowedRunnerFacts?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: allowed injected runner facts must be ok=true");
}

const architectureCapability = selectHumanProjectCapability({
  meaning: structuredMeaning,
  repoFacts: sampleRepoFacts,
});

if (architectureCapability?.capability !== HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE) {
  throw new Error("Human Mode skeleton smoke check failed: architecture capability mismatch");
}

const architectureResponse = buildHumanProjectIntentResponse({
  repoFacts: sampleRepoFacts,
  capability: architectureCapability,
});

if (architectureResponse?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: architecture response must be ok=true");
}

if (!architectureResponse?.text?.includes("RepoStateAgent")) {
  throw new Error("Human Mode skeleton smoke check failed: architecture response must mention RepoStateAgent source");
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

const riskResponse = buildHumanProjectIntentResponse({
  repoFacts: sampleRepoFacts,
  capability: riskCapability,
});

if (riskResponse?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: risk response must be ok=true");
}

const fullPipeline = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: true,
  isPrivateChat: true,
  context: {
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "test",
    },
    repoStateAgentResult: sampleRepoStateAgentResult,
  },
});

if (fullPipeline?.handled !== true) {
  throw new Error("Human Mode skeleton smoke check failed: full context pipeline must be handled");
}

if (fullPipeline?.capability?.capability !== HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE) {
  throw new Error("Human Mode skeleton smoke check failed: full context pipeline capability mismatch");
}

if (fullPipeline?.response?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: full context pipeline response must be ok=true");
}

console.log("OK: Human Mode skeleton imports and basic skeleton contract are valid.");
