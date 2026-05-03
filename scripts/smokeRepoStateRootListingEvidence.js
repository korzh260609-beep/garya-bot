// scripts/smokeRepoStateRootListingEvidence.js
// ============================================================================
// Smoke — RepoState root listing evidence
// ============================================================================

import assert from "node:assert/strict";
import { buildRepoStateProjectMap } from "../src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js";
import { buildLivingSourceResultSystemMessage } from "../src/core/living-sg/LivingSourceResultSystemMessage.js";
import { LIVING_SOURCE_RESULT_CONFIRMATION_STATUS } from "../src/core/living-sg/LivingSourceResultEnvelope.js";

const projectMap = buildRepoStateProjectMap({
  repoFullName: "korzh260609-beep/garya-bot",
  branch: "main",
  headCommitSha: "test-head",
  filesCount: 5,
  modulesCount: 2,
  dependenciesCount: 0,
  tree: {
    files: [
      { path: ".github/workflows/ci.yml", extension: ".yml", size: 10 },
      { path: "src/core/example.js", extension: ".js", size: 10 },
      { path: "pillars/DECISIONS.md", extension: ".md", size: 10 },
      { path: "package.json", extension: ".json", size: 10 },
      { path: "README.md", extension: ".md", size: 10 },
    ],
    structureComplete: true,
  },
  modules: [],
  dependencies: [],
});

assert.equal(projectMap.schemaVersion, 7);
assert.deepEqual(projectMap.rootListing.directories, [".github", "pillars", "src"]);
assert.deepEqual(
  projectMap.rootListing.files.map((file) => file.path),
  ["package.json", "README.md"]
);

const message = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: {
    canClaimVerifiedFacts: true,
    kind: "repo_state_agent_project_map",
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      scope: "repo_state_agent_project_map",
    },
    freshness: {
      status: "fresh",
      checkedAt: "2026-05-03T00:00:00.000Z",
      sourceUpdatedAt: "2026-05-03T00:00:00.000Z",
    },
    confirmation: {
      status: LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED,
      confirmedBy: "smoke",
      reason: "test",
    },
    payload: {
      projectMap,
    },
  },
});

assert.ok(message.content.includes("rootListing:"));
assert.ok(message.content.includes("root.directories=.github, pillars, src"));
assert.ok(message.content.includes("root.files=package.json, README.md"));
assert.ok(message.content.includes("For repository root folders or root files, answer only from rootListing above."));

console.log("Smoke RepoState Root Listing Evidence — OK");
