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
import { createHumanRepoStateAgentRunner } from "../src/core/projectIntent/modes/human/projectIntentHumanRepoStateAgentRunner.js";
import {
  buildHumanProjectIntentContext,
  hasHumanMeaningExecutionPermission,
  hasHumanRepoStateAgentExecutionPermission,
} from "../src/core/projectIntent/modes/human/projectIntentHumanContext.js";

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
assertFunction("createHumanRepoStateAgentRunner", createHumanRepoStateAgentRunner);
assertFunction("buildHumanProjectIntentContext", buildHumanProjectIntentContext);
assertFunction("hasHumanMeaningExecutionPermission", hasHumanMeaningExecutionPermission);
assertFunction("hasHumanRepoStateAgentExecutionPermission", hasHumanRepoStateAgentExecutionPermission);

const rawTextMeaning = await classifyHumanProjectIntentMeaning({
  text: "проверь архитектуру проекта",
});

if (rawTextMeaning?.intentKind !== HUMAN_PROJECT_INTENT_KINDS.UNKNOWN) {
  throw new Error("Human Mode skeleton smoke check failed: raw text must not be classified yet");
}

let blockedMeaningProviderCallCount = 0;
const blockedProviderMeaning = await classifyHumanProjectIntentMeaning({
  text: "проверь архитектуру проекта",
  context: buildHumanProjectIntentContext({
    humanProjectIntentMeaningProvider: async () => {
      blockedMeaningProviderCallCount += 1;
      throw new Error("humanProjectIntentMeaningProvider must not be called without allowHumanMeaningProviderRun=true");
    },
  }),
});

if (blockedMeaningProviderCallCount !== 0) {
  throw new Error("Human Mode skeleton smoke check failed: blocked meaning provider must not be called");
}

if (blockedProviderMeaning?.reason !== "human_meaning_provider_present_but_not_allowed") {
  throw new Error("Human Mode skeleton smoke check failed: blocked meaning provider reason mismatch");
}

const denied = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: false,
  isPrivateChat: false,
});

if (denied?.mode !== "human" || denied?.blocked !== true) {
  throw new Error("Human Mode skeleton smoke check failed: denied skeleton call mismatch");
}

const allowed = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: true,
  isPrivateChat: true,
});

if (allowed?.allowed !== true || allowed?.handled !== false) {
  throw new Error("Human Mode skeleton smoke check failed: allowed skeleton must not handle without repo facts");
}

const missingRepoFacts = await loadHumanProjectRepoFacts();

if (missingRepoFacts?.ok !== false || missingRepoFacts?.reason !== "repo_state_agent_result_not_provided") {
  throw new Error("Human Mode skeleton smoke check failed: missing repo facts mismatch");
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

if (sampleRepoFacts?.ok !== true || sampleRepoFacts?.facts?.repo?.fullName !== "korzh260609-beep/garya-bot") {
  throw new Error("Human Mode skeleton smoke check failed: sample repo facts mismatch");
}

let allowedMeaningProviderCallCount = 0;
const meaningProviderContext = buildHumanProjectIntentContext({
  allowHumanMeaningProviderRun: true,
  humanProjectIntentMeaningProvider: async (providerContext) => {
    allowedMeaningProviderCallCount += 1;

    if (providerContext?.mode !== "human") {
      throw new Error("Human Mode skeleton smoke check failed: meaning provider mode mismatch");
    }

    return {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "provider-test",
    };
  },
});

if (hasHumanMeaningExecutionPermission(meaningProviderContext) !== true) {
  throw new Error("Human Mode skeleton smoke check failed: meaning permission must be true");
}

const providerMeaning = await classifyHumanProjectIntentMeaning({
  text: "проверь архитектуру проекта",
  context: meaningProviderContext,
});

if (allowedMeaningProviderCallCount !== 1 || providerMeaning?.intentKind !== HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION) {
  throw new Error("Human Mode skeleton smoke check failed: allowed meaning provider mismatch");
}

const structuredMeaning = await classifyHumanProjectIntentMeaning({
  context: buildHumanProjectIntentContext({
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "test",
    },
  }),
});

if (structuredMeaning?.intentKind !== HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION) {
  throw new Error("Human Mode skeleton smoke check failed: structured meaning was not accepted");
}

let injectedRunnerCallCount = 0;
const repoRunnerContext = buildHumanProjectIntentContext({
  allowHumanRepoStateAgentRun: true,
  repoStateAgentRunner: async (runnerContext) => {
    injectedRunnerCallCount += 1;

    if (runnerContext?.mode !== "human") {
      throw new Error("Human Mode skeleton smoke check failed: injected runner mode mismatch");
    }

    return sampleRepoStateAgentResult;
  },
});

if (hasHumanRepoStateAgentExecutionPermission(repoRunnerContext) !== true) {
  throw new Error("Human Mode skeleton smoke check failed: repo runner permission must be true");
}

const allowedRunnerFacts = await loadHumanProjectRepoFacts({ context: repoRunnerContext });

if (injectedRunnerCallCount !== 1 || allowedRunnerFacts?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: allowed injected runner facts mismatch");
}

let adapterServiceConstructed = 0;
let adapterServiceRunCount = 0;
class MockRepoStateAgentService {
  constructor() {
    adapterServiceConstructed += 1;
  }

  async run(options = {}) {
    adapterServiceRunCount += 1;

    if (options?.dryRun !== true) {
      throw new Error("Human Mode skeleton smoke check failed: adapter default options mismatch");
    }

    return sampleRepoStateAgentResult;
  }
}

const adapterRunner = createHumanRepoStateAgentRunner({
  RepoStateAgentServiceClass: MockRepoStateAgentService,
  defaultOptions: {
    dryRun: true,
  },
});

const blockedAdapterResult = await adapterRunner({ mode: "technical" });

if (blockedAdapterResult?.reason !== "human_repo_state_agent_runner_requires_human_mode") {
  throw new Error("Human Mode skeleton smoke check failed: adapter runner must require human mode");
}

if (adapterServiceConstructed !== 0 || adapterServiceRunCount !== 0) {
  throw new Error("Human Mode skeleton smoke check failed: blocked adapter runner must not construct service");
}

const adapterResult = await adapterRunner({ mode: "human" });

if (adapterServiceConstructed !== 1 || adapterServiceRunCount !== 1 || adapterResult?.repoFullName !== "korzh260609-beep/garya-bot") {
  throw new Error("Human Mode skeleton smoke check failed: adapter runner mismatch");
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

if (architectureResponse?.ok !== true || !architectureResponse?.text?.includes("RepoStateAgent")) {
  throw new Error("Human Mode skeleton smoke check failed: architecture response mismatch");
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
  context: buildHumanProjectIntentContext({
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "test",
    },
    repoStateAgentResult: sampleRepoStateAgentResult,
  }),
});

if (fullPipeline?.handled !== true || fullPipeline?.response?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: full context pipeline mismatch");
}

const fullPipelineWithAdapterRunner = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: true,
  isPrivateChat: true,
  context: buildHumanProjectIntentContext({
    allowHumanRepoStateAgentRun: true,
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
      confidence: "test",
    },
    repoStateAgentRunner: adapterRunner,
  }),
});

if (adapterServiceConstructed !== 2 || adapterServiceRunCount !== 2) {
  throw new Error("Human Mode skeleton smoke check failed: full pipeline adapter runner must run service once more");
}

if (fullPipelineWithAdapterRunner?.handled !== true || fullPipelineWithAdapterRunner?.repoFacts?.ok !== true) {
  throw new Error("Human Mode skeleton smoke check failed: full pipeline with adapter runner mismatch");
}

let fullPipelineMeaningProviderCallCount = 0;
const fullPipelineWithMeaningProvider = await handleHumanProjectIntent({
  text: "проверь архитектуру проекта",
  isMonarchUser: true,
  isPrivateChat: true,
  context: buildHumanProjectIntentContext({
    allowHumanMeaningProviderRun: true,
    repoStateAgentResult: sampleRepoStateAgentResult,
    humanProjectIntentMeaningProvider: async () => {
      fullPipelineMeaningProviderCallCount += 1;
      return {
        intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
        confidence: "provider-test",
      };
    },
  }),
});

if (fullPipelineMeaningProviderCallCount !== 1 || fullPipelineWithMeaningProvider?.handled !== true) {
  throw new Error("Human Mode skeleton smoke check failed: full pipeline meaning provider mismatch");
}

console.log("OK: Human Mode skeleton imports and basic skeleton contract are valid.");
