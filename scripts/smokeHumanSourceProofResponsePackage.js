// scripts/smokeHumanSourceProofResponsePackage.js
// ============================================================================
// Smoke — Human Mode Source Proof Response Package
//
// Verifies the sourceProof propagation chain:
// repoFacts.sourceProof -> contextPack.repoFacts.sourceProof -> response.sourceProof.
// No runtime wiring, repo reads, AI calls, Technical Mode, or command routing.
// ============================================================================

import assert from "node:assert/strict";

import { buildHumanProjectContextPack } from "../src/core/projectIntent/modes/human/projectIntentHumanContextPackBuilder.js";
import { buildHumanProjectIntentResponse } from "../src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js";

const repoFacts = {
  ok: true,
  source: "RepoStateAgent",
  sourceProof: {
    verified: true,
    source: "RepoStateAgent",
    canClaimVerifiedFacts: true,
    canAuthorizeWrite: false,
    canExecute: false,
    reason: "repo_state_agent_facts_loaded",
  },
  facts: {
    repo: {
      fullName: "korzh260609-beep/garya-bot",
      branch: "main",
    },
    totals: {
      files: 10,
      modules: 3,
      dependencies: 2,
    },
    architectureHealth: {
      status: "ok",
      score: 90,
    },
    nextActionPlan: {
      summary: "Next safe step",
      actions: ["Keep source proof read-only"],
    },
  },
};

const contextPack = buildHumanProjectContextPack({
  context: {
    activeProjectContext: {
      active: true,
      source: "smoke",
      projectKey: "sg",
      projectName: "SG",
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
    },
  },
  repoFacts,
  meaning: {
    intentKind: "source_question",
    confidence: "structured",
  },
});

assert.equal(contextPack.ok, true, "contextPack must build");
assert.equal(contextPack.repoFacts.available, true, "contextPack must expose repoFacts availability");
assert.equal(contextPack.repoFacts.sourceProof.available, true, "contextPack must expose sourceProof");
assert.equal(contextPack.repoFacts.sourceProof.verified, true, "contextPack sourceProof must be verified");
assert.equal(
  contextPack.repoFacts.sourceProof.canClaimVerifiedFacts,
  true,
  "contextPack sourceProof must preserve verified facts claim"
);
assert.equal(
  contextPack.repoFacts.sourceProof.canAuthorizeWrite,
  false,
  "contextPack sourceProof must not authorize writes"
);
assert.equal(
  contextPack.repoFacts.sourceProof.canExecute,
  false,
  "contextPack sourceProof must not execute actions"
);
assert.equal(contextPack.policy.sourceProofCannotAuthorizeWrites, true, "contextPack policy must block proof write authority");
assert.equal(contextPack.policy.sourceProofCannotExecuteActions, true, "contextPack policy must block proof execution authority");

const response = buildHumanProjectIntentResponse({
  repoFacts,
  contextPack,
  capability: {
    ready: true,
    capability: "explain_sources",
  },
});

assert.equal(response.ok, true, "response must build");
assert.equal(response.sourceProof.available, true, "response must expose sourceProof");
assert.equal(response.sourceProof.verified, true, "response sourceProof must be verified");
assert.equal(
  response.sourceProof.canClaimVerifiedFacts,
  true,
  "response sourceProof must preserve verified facts claim"
);
assert.equal(
  response.sourceProof.canAuthorizeWrite,
  false,
  "response sourceProof must not authorize writes"
);
assert.equal(
  response.sourceProof.canExecute,
  false,
  "response sourceProof must not execute actions"
);
assert.equal(response.policy.sourceProofCannotAuthorizeWrites, true, "response policy must block proof write authority");
assert.equal(response.policy.sourceProofCannotExecuteActions, true, "response policy must block proof execution authority");
assert.match(response.text, /RepoStateAgent/, "response text must still explain RepoStateAgent as source");
assert.match(response.text, /verified/, "source response must mention proof verification status");

const missingProofContextPack = buildHumanProjectContextPack({
  repoFacts: {
    ok: false,
    source: "RepoStateAgent",
    facts: null,
  },
});

assert.equal(
  missingProofContextPack.repoFacts.sourceProof.available,
  false,
  "missing contextPack sourceProof must be unavailable"
);
assert.equal(
  missingProofContextPack.repoFacts.sourceProof.verified,
  false,
  "missing contextPack sourceProof must not be verified"
);
assert.equal(
  missingProofContextPack.repoFacts.sourceProof.canAuthorizeWrite,
  false,
  "missing contextPack sourceProof must not authorize writes"
);
assert.equal(
  missingProofContextPack.repoFacts.sourceProof.canExecute,
  false,
  "missing contextPack sourceProof must not execute actions"
);

const missingProofResponse = buildHumanProjectIntentResponse({
  repoFacts: {
    ok: false,
    source: "RepoStateAgent",
    facts: null,
  },
  contextPack: missingProofContextPack,
  capability: {
    ready: false,
    capability: "none",
  },
});

assert.equal(missingProofResponse.ok, false, "missing proof response must stay not ok");
assert.equal(missingProofResponse.sourceProof.available, false, "missing response sourceProof must be unavailable");
assert.equal(missingProofResponse.sourceProof.verified, false, "missing response sourceProof must not be verified");
assert.equal(missingProofResponse.sourceProof.canAuthorizeWrite, false, "missing response sourceProof must not authorize writes");
assert.equal(missingProofResponse.sourceProof.canExecute, false, "missing response sourceProof must not execute actions");

console.log("Smoke Human source proof response package — OK");
