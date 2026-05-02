// scripts/smokeHumanRepoFactsSourceProof.js
// ============================================================================
// Smoke — Human Mode Repo Facts Source Proof
//
// Verifies that Human Mode repoFacts carry a simple sourceProof contract without
// adding runtime wiring, repo reads, Technical Mode, or command routing.
// ============================================================================

import assert from "node:assert/strict";

import {
  buildHumanProjectRepoFactsFromRepoStateAgentResult,
  loadHumanProjectRepoFacts,
} from "../src/core/projectIntent/modes/human/projectIntentHumanRepoFacts.js";

const validRepoFacts = buildHumanProjectRepoFactsFromRepoStateAgentResult({
  projectMap: {
    repo: {
      fullName: "korzh260609-beep/garya-bot",
      branch: "main",
    },
    totals: {
      files: 10,
      modules: 3,
      dependencies: 2,
    },
  },
  architectureHealth: {
    status: "ok",
    score: 90,
  },
});

assert.equal(validRepoFacts.ok, true, "valid RepoStateAgent result must load repo facts");
assert.equal(validRepoFacts.sourceProof.verified, true, "valid repo facts must be verified");
assert.equal(
  validRepoFacts.sourceProof.canClaimVerifiedFacts,
  true,
  "verified repo facts may claim verified facts"
);
assert.equal(validRepoFacts.sourceProof.canAuthorizeWrite, false, "repo facts proof must not authorize writes");
assert.equal(validRepoFacts.sourceProof.canExecute, false, "repo facts proof must not execute actions");
assert.equal(validRepoFacts.sourceProof.metadata.noSourceCall, true, "sourceProof must not call sources");
assert.equal(validRepoFacts.sourceProof.metadata.noRuntimeRepoRead, true, "sourceProof must not read repo runtime");
assert.equal(validRepoFacts.sourceProof.metadata.noTechnicalModeExpansion, true, "sourceProof must not expand Technical Mode");
assert.equal(validRepoFacts.sourceProof.metadata.noSlashCommandsAdded, true, "sourceProof must not add slash commands");

const invalidRepoFacts = buildHumanProjectRepoFactsFromRepoStateAgentResult(null);

assert.equal(invalidRepoFacts.ok, false, "missing RepoStateAgent result must fail repo facts");
assert.equal(invalidRepoFacts.sourceProof.verified, false, "missing repo facts must not be verified");
assert.equal(
  invalidRepoFacts.sourceProof.canClaimVerifiedFacts,
  false,
  "missing repo facts must not claim verified facts"
);
assert.equal(
  invalidRepoFacts.sourceProof.reason,
  "repo_state_agent_result_missing_or_invalid",
  "missing facts sourceProof must explain the failure"
);

const noRuntimeFacts = await loadHumanProjectRepoFacts({ context: null });

assert.equal(noRuntimeFacts.ok, false, "no context must not load repo facts");
assert.equal(noRuntimeFacts.sourceProof.verified, false, "no context must not be verified");
assert.equal(noRuntimeFacts.sourceProof.metadata.noRuntimeRepoRead, true, "no-context path must not read repo runtime");
assert.equal(noRuntimeFacts.sourceProof.metadata.noTechnicalModeExpansion, true, "no-context path must not expand Technical Mode");

console.log("Smoke Human repo facts source proof — OK");
