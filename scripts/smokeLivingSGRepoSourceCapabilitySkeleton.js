// scripts/smokeLivingSGRepoSourceCapabilitySkeleton.js
// ============================================================================
// LIVING SG REPO SOURCE CAPABILITY SKELETON SMOKE CHECK
//
// Purpose:
// - verify the Living SG repo source capability skeleton imports;
// - verify read-only repo facts require runtime source confirmation;
// - verify missing runtime source cannot produce verified repo claims;
// - verify repo write remains blocked;
// - verify no runtime repo-read, executor, RepoStateAgent runtime, Technical Mode,
//   or slash-command expansion is introduced.
// ============================================================================

import {
  LIVING_REPO_SOURCE_CAPABILITY,
  LIVING_REPO_SOURCE_STATUS,
  LIVING_REPO_SOURCE_ACTION_TYPE,
  createLivingRepoSourceCapabilityPlan,
} from "../src/core/living-sg/LivingRepoSourceCapability.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG repo source skeleton smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertBool(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG repo source skeleton smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Living SG repo source skeleton smoke check failed: ${name} is not a function`);
  }
}

assertFunction("createLivingRepoSourceCapabilityPlan", createLivingRepoSourceCapabilityPlan);

assertEqual(
  "capability.repoFactsRead",
  LIVING_REPO_SOURCE_CAPABILITY.REPO_FACTS_READ,
  "repo_facts_read"
);
assertEqual(
  "capability.repoWrite",
  LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE,
  "repo_write"
);
assertEqual(
  "status.sourceNotConnected",
  LIVING_REPO_SOURCE_STATUS.SOURCE_NOT_CONNECTED,
  "source_not_connected"
);
assertEqual(
  "actionType.readOnly",
  LIVING_REPO_SOURCE_ACTION_TYPE.READ_ONLY,
  "read_only"
);

const missingSourcePlan = createLivingRepoSourceCapabilityPlan({
  requestedCapability: LIVING_REPO_SOURCE_CAPABILITY.REPO_FACTS_READ,
  repoRuntimeConnected: false,
  sourceResultConfirmed: false,
});

assertBool("missingSourcePlan.ok", missingSourcePlan.ok, true);
assertBool("missingSourcePlan.dryRun", missingSourcePlan.dryRun, true);
assertEqual("missingSourcePlan.source", missingSourcePlan.source, "LivingRepoSourceCapability");
assertEqual("missingSourcePlan.status", missingSourcePlan.status, LIVING_REPO_SOURCE_STATUS.SOURCE_NOT_CONNECTED);
assertEqual("missingSourcePlan.actionType", missingSourcePlan.actionType, LIVING_REPO_SOURCE_ACTION_TYPE.READ_ONLY);
assertBool("missingSourcePlan.canReadRepo", missingSourcePlan.canReadRepo, false);
assertBool("missingSourcePlan.canWriteRepo", missingSourcePlan.canWriteRepo, false);
assertBool("missingSourcePlan.canClaimVerifiedRepoFacts", missingSourcePlan.canClaimVerifiedRepoFacts, false);
assertBool("missingSourcePlan.requiresRuntimeSource", missingSourcePlan.requiresRuntimeSource, true);
assertBool("missingSourcePlan.requiresSourceResultConfirmation", missingSourcePlan.requiresSourceResultConfirmation, true);
assertBool("missingSourcePlan.metadata.noRuntimeRepoRead", missingSourcePlan.metadata.noRuntimeRepoRead, true);
assertBool("missingSourcePlan.metadata.noRuntimeRepoWrite", missingSourcePlan.metadata.noRuntimeRepoWrite, true);
assertBool("missingSourcePlan.metadata.noExecutor", missingSourcePlan.metadata.noExecutor, true);
assertBool("missingSourcePlan.metadata.noRepoStateAgentRuntime", missingSourcePlan.metadata.noRepoStateAgentRuntime, true);
assertBool("missingSourcePlan.metadata.noTechnicalModeExpansion", missingSourcePlan.metadata.noTechnicalModeExpansion, true);
assertBool("missingSourcePlan.metadata.noSlashCommandsAdded", missingSourcePlan.metadata.noSlashCommandsAdded, true);

const confirmedReadPlan = createLivingRepoSourceCapabilityPlan({
  requestedCapability: LIVING_REPO_SOURCE_CAPABILITY.REPO_STATUS_READ,
  repoRuntimeConnected: true,
  sourceResultConfirmed: true,
});

assertBool("confirmedReadPlan.ok", confirmedReadPlan.ok, true);
assertBool("confirmedReadPlan.dryRun", confirmedReadPlan.dryRun, true);
assertEqual("confirmedReadPlan.status", confirmedReadPlan.status, LIVING_REPO_SOURCE_STATUS.READ_ONLY_ALLOWED_BY_CONTRACT);
assertBool("confirmedReadPlan.canReadRepo", confirmedReadPlan.canReadRepo, true);
assertBool("confirmedReadPlan.canWriteRepo", confirmedReadPlan.canWriteRepo, false);
assertBool("confirmedReadPlan.canClaimVerifiedRepoFacts", confirmedReadPlan.canClaimVerifiedRepoFacts, true);
assertBool("confirmedReadPlan.metadata.noRuntimeRepoRead", confirmedReadPlan.metadata.noRuntimeRepoRead, true);
assertBool("confirmedReadPlan.metadata.noRuntimeRepoWrite", confirmedReadPlan.metadata.noRuntimeRepoWrite, true);
assertBool("confirmedReadPlan.metadata.noExecutor", confirmedReadPlan.metadata.noExecutor, true);
assertBool("confirmedReadPlan.metadata.noRepoStateAgentRuntime", confirmedReadPlan.metadata.noRepoStateAgentRuntime, true);

const writePlan = createLivingRepoSourceCapabilityPlan({
  requestedCapability: LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE,
  repoRuntimeConnected: true,
  sourceResultConfirmed: true,
});

assertBool("writePlan.ok", writePlan.ok, false);
assertBool("writePlan.dryRun", writePlan.dryRun, true);
assertEqual("writePlan.status", writePlan.status, LIVING_REPO_SOURCE_STATUS.WRITE_BLOCKED);
assertEqual("writePlan.actionType", writePlan.actionType, LIVING_REPO_SOURCE_ACTION_TYPE.STATE_CHANGING);
assertBool("writePlan.canReadRepo", writePlan.canReadRepo, false);
assertBool("writePlan.canWriteRepo", writePlan.canWriteRepo, false);
assertBool("writePlan.canClaimVerifiedRepoFacts", writePlan.canClaimVerifiedRepoFacts, false);
assertBool("writePlan.requiresExplicitPermission", writePlan.requiresExplicitPermission, true);
assertBool("writePlan.metadata.noRuntimeRepoRead", writePlan.metadata.noRuntimeRepoRead, true);
assertBool("writePlan.metadata.noRuntimeRepoWrite", writePlan.metadata.noRuntimeRepoWrite, true);
assertBool("writePlan.metadata.noExecutor", writePlan.metadata.noExecutor, true);
assertBool("writePlan.metadata.noRepoStateAgentRuntime", writePlan.metadata.noRepoStateAgentRuntime, true);
assertBool("writePlan.metadata.noTechnicalModeExpansion", writePlan.metadata.noTechnicalModeExpansion, true);
assertBool("writePlan.metadata.noSlashCommandsAdded", writePlan.metadata.noSlashCommandsAdded, true);

console.log("OK: Living SG repo source capability skeleton is read-only, source-honest, and blocks repo writes.");
