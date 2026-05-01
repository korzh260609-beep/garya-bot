// scripts/smokeLivingSGRepoReadRequestPlanner.js
// ============================================================================
// LIVING SG REPO READ REQUEST PLANNER SMOKE CHECK
//
// Purpose:
// - verify the repo-read request planner is contract-only;
// - verify it can plan that repo facts are needed;
// - verify it does not read the repository or call sources;
// - verify planner output cannot prove repo facts;
// - verify repo writes remain blocked.
// ============================================================================

import {
  LIVING_REPO_READ_REQUEST_KIND,
  LIVING_REPO_READ_REQUEST_STATUS,
  createLivingRepoReadRequestPlan,
} from "../src/core/living-sg/LivingRepoReadRequestPlan.js";
import { LIVING_REPO_SOURCE_STATUS } from "../src/core/living-sg/LivingRepoSourceCapability.js";
import { LIVING_SOURCE_PROOF_STATUS } from "../src/core/living-sg/LivingSourceProofBoundary.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG repo-read planner smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertBool(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG repo-read planner smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Living SG repo-read planner smoke check failed: ${name} is not a function`);
  }
}

assertFunction("createLivingRepoReadRequestPlan", createLivingRepoReadRequestPlan);

assertEqual("kind.repoFacts", LIVING_REPO_READ_REQUEST_KIND.REPO_FACTS, "repo_facts");
assertEqual("kind.repoStatus", LIVING_REPO_READ_REQUEST_KIND.REPO_STATUS, "repo_status");
assertEqual("kind.repoFile", LIVING_REPO_READ_REQUEST_KIND.REPO_FILE, "repo_file");
assertEqual(
  "status.plannedSourceRequired",
  LIVING_REPO_READ_REQUEST_STATUS.PLANNED_SOURCE_REQUIRED,
  "planned_source_required"
);

const notNeeded = createLivingRepoReadRequestPlan({
  requested: false,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.NONE,
});

assertBool("notNeeded.ok", notNeeded.ok, true);
assertBool("notNeeded.dryRun", notNeeded.dryRun, true);
assertEqual("notNeeded.status", notNeeded.status, LIVING_REPO_READ_REQUEST_STATUS.NOT_NEEDED);
assertBool("notNeeded.shouldRequestSource", notNeeded.shouldRequestSource, false);
assertBool("notNeeded.canReadRepo", notNeeded.canReadRepo, false);
assertBool("notNeeded.canWriteRepo", notNeeded.canWriteRepo, false);
assertBool("notNeeded.canClaimVerifiedRepoFacts", notNeeded.canClaimVerifiedRepoFacts, false);
assertBool("notNeeded.metadata.noRuntimeRepoRead", notNeeded.metadata.noRuntimeRepoRead, true);
assertBool("notNeeded.metadata.noSourceCall", notNeeded.metadata.noSourceCall, true);
assertBool("notNeeded.metadata.noExecutor", notNeeded.metadata.noExecutor, true);
assertBool("notNeeded.metadata.noRepoStateAgentRuntime", notNeeded.metadata.noRepoStateAgentRuntime, true);
assertEqual("notNeeded.sourceProof.status", notNeeded.sourceProof.status, LIVING_SOURCE_PROOF_STATUS.NOT_REQUESTED);

const plannedFacts = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FACTS,
  target: "project architecture status",
});

assertBool("plannedFacts.ok", plannedFacts.ok, true);
assertBool("plannedFacts.dryRun", plannedFacts.dryRun, true);
assertEqual("plannedFacts.source", plannedFacts.source, "LivingRepoReadRequestPlan");
assertEqual("plannedFacts.status", plannedFacts.status, LIVING_REPO_READ_REQUEST_STATUS.PLANNED_SOURCE_REQUIRED);
assertEqual("plannedFacts.requestKind", plannedFacts.requestKind, LIVING_REPO_READ_REQUEST_KIND.REPO_FACTS);
assertEqual("plannedFacts.target", plannedFacts.target, "project architecture status");
assertBool("plannedFacts.shouldRequestSource", plannedFacts.shouldRequestSource, true);
assertBool("plannedFacts.canReadRepo", plannedFacts.canReadRepo, false);
assertBool("plannedFacts.canWriteRepo", plannedFacts.canWriteRepo, false);
assertBool("plannedFacts.canClaimVerifiedRepoFacts", plannedFacts.canClaimVerifiedRepoFacts, false);
assertBool("plannedFacts.requiresSourceProof", plannedFacts.requiresSourceProof, true);
assertEqual(
  "plannedFacts.capabilityPlan.status",
  plannedFacts.capabilityPlan.status,
  LIVING_REPO_SOURCE_STATUS.SOURCE_NOT_CONNECTED
);
assertBool("plannedFacts.capabilityPlan.canReadRepo", plannedFacts.capabilityPlan.canReadRepo, false);
assertBool("plannedFacts.capabilityPlan.canClaimVerifiedRepoFacts", plannedFacts.capabilityPlan.canClaimVerifiedRepoFacts, false);
assertEqual(
  "plannedFacts.sourceProof.status",
  plannedFacts.sourceProof.status,
  LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED
);
assertBool("plannedFacts.sourceProof.verified", plannedFacts.sourceProof.verified, false);
assertBool("plannedFacts.sourceProof.canClaimVerifiedFacts", plannedFacts.sourceProof.canClaimVerifiedFacts, false);
assertBool("plannedFacts.metadata.noRuntimeRepoRead", plannedFacts.metadata.noRuntimeRepoRead, true);
assertBool("plannedFacts.metadata.noRuntimeRepoWrite", plannedFacts.metadata.noRuntimeRepoWrite, true);
assertBool("plannedFacts.metadata.noSourceCall", plannedFacts.metadata.noSourceCall, true);
assertBool("plannedFacts.metadata.noExecutor", plannedFacts.metadata.noExecutor, true);
assertBool("plannedFacts.metadata.noRepoStateAgentRuntime", plannedFacts.metadata.noRepoStateAgentRuntime, true);
assertBool("plannedFacts.metadata.noTechnicalModeExpansion", plannedFacts.metadata.noTechnicalModeExpansion, true);
assertBool("plannedFacts.metadata.noSlashCommandsAdded", plannedFacts.metadata.noSlashCommandsAdded, true);

const plannedFile = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "src/core/living-sg/LivingSGBoundary.js",
});

assertEqual("plannedFile.requestKind", plannedFile.requestKind, LIVING_REPO_READ_REQUEST_KIND.REPO_FILE);
assertBool("plannedFile.shouldRequestSource", plannedFile.shouldRequestSource, true);
assertBool("plannedFile.canReadRepo", plannedFile.canReadRepo, false);
assertBool("plannedFile.canClaimVerifiedRepoFacts", plannedFile.canClaimVerifiedRepoFacts, false);

const blockedWrite = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "src/core/living-sg/LivingSGBoundary.js",
  writeRequested: true,
});

assertBool("blockedWrite.ok", blockedWrite.ok, false);
assertBool("blockedWrite.dryRun", blockedWrite.dryRun, true);
assertEqual("blockedWrite.status", blockedWrite.status, LIVING_REPO_READ_REQUEST_STATUS.BLOCKED_WRITE_REQUEST);
assertBool("blockedWrite.shouldRequestSource", blockedWrite.shouldRequestSource, false);
assertBool("blockedWrite.canReadRepo", blockedWrite.canReadRepo, false);
assertBool("blockedWrite.canWriteRepo", blockedWrite.canWriteRepo, false);
assertBool("blockedWrite.canClaimVerifiedRepoFacts", blockedWrite.canClaimVerifiedRepoFacts, false);
assertEqual("blockedWrite.capabilityPlan.status", blockedWrite.capabilityPlan.status, LIVING_REPO_SOURCE_STATUS.WRITE_BLOCKED);
assertEqual("blockedWrite.sourceProof.status", blockedWrite.sourceProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assertBool("blockedWrite.metadata.noRuntimeRepoRead", blockedWrite.metadata.noRuntimeRepoRead, true);
assertBool("blockedWrite.metadata.noRuntimeRepoWrite", blockedWrite.metadata.noRuntimeRepoWrite, true);
assertBool("blockedWrite.metadata.noSourceCall", blockedWrite.metadata.noSourceCall, true);
assertBool("blockedWrite.metadata.noExecutor", blockedWrite.metadata.noExecutor, true);
assertBool("blockedWrite.metadata.noRepoStateAgentRuntime", blockedWrite.metadata.noRepoStateAgentRuntime, true);
assertBool("blockedWrite.metadata.noTechnicalModeExpansion", blockedWrite.metadata.noTechnicalModeExpansion, true);
assertBool("blockedWrite.metadata.noSlashCommandsAdded", blockedWrite.metadata.noSlashCommandsAdded, true);

console.log("OK: Living SG repo-read request planner plans source requests without reading repo or proving facts.");
