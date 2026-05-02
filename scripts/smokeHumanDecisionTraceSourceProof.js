// scripts/smokeHumanDecisionTraceSourceProof.js
// ============================================================================
// Smoke — Human Mode Decision Trace Source Proof
//
// Verifies that Human Mode decisionTrace exposes repoFacts.sourceProof as
// read-only audit metadata without adding runtime wiring, repo reads, AI calls,
// Technical Mode, or command routing.
// ============================================================================

import assert from "node:assert/strict";

import { buildHumanProjectDecisionTrace } from "../src/core/projectIntent/modes/human/projectIntentHumanDecisionTraceBuilder.js";

const trace = buildHumanProjectDecisionTrace({
  contextPack: {
    activeProject: {
      name: "SG",
      repository: "korzh260609-beep/garya-bot",
    },
    repoFacts: {
      available: true,
      source: "RepoStateAgent",
    },
  },
  meaning: {
    intentKind: "repo_status_question",
    confidence: "structured",
    reason: "smoke_structured_meaning",
  },
  capability: {
    capability: "answer_from_repo_state",
    ready: true,
    reason: "smoke_capability_selected",
  },
  repoFacts: {
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
    },
  },
  response: {
    ok: true,
    mode: "human",
    reason: "smoke_response_built",
    text: "ok",
  },
});

assert.equal(trace.ok, true, "trace must be built");
assert.equal(trace.repoFactsSummary.available, true, "repo facts must be available in trace");
assert.equal(trace.repoFactsSummary.source, "RepoStateAgent", "trace must keep repo facts source");
assert.equal(trace.repoFactsSummary.sourceProof.available, true, "trace must expose sourceProof availability");
assert.equal(trace.repoFactsSummary.sourceProof.verified, true, "trace must expose verified sourceProof");
assert.equal(
  trace.repoFactsSummary.sourceProof.canClaimVerifiedFacts,
  true,
  "trace must expose verified facts claim"
);
assert.equal(
  trace.repoFactsSummary.sourceProof.canAuthorizeWrite,
  false,
  "trace sourceProof must not authorize writes"
);
assert.equal(
  trace.repoFactsSummary.sourceProof.canExecute,
  false,
  "trace sourceProof must not execute actions"
);
assert.equal(
  trace.repoFactsSummary.sourceProof.reason,
  "repo_state_agent_facts_loaded",
  "trace must keep sourceProof reason"
);
assert.equal(trace.policy.sourceProofCannotAuthorizeWrites, true, "trace policy must block sourceProof write authority");
assert.equal(trace.policy.sourceProofCannotExecuteActions, true, "trace policy must block sourceProof execution authority");
assert.equal(trace.policy.noKeywordMatching, true, "trace must not use keyword matching");
assert.equal(trace.policy.noPhraseMatching, true, "trace must not use phrase matching");

const missingProofTrace = buildHumanProjectDecisionTrace({
  repoFacts: {
    ok: false,
    source: "RepoStateAgent",
    facts: null,
  },
});

assert.equal(missingProofTrace.repoFactsSummary.sourceProof.available, false, "missing proof must be marked unavailable");
assert.equal(missingProofTrace.repoFactsSummary.sourceProof.verified, false, "missing proof must not be verified");
assert.equal(
  missingProofTrace.repoFactsSummary.sourceProof.reason,
  "repo_facts_source_proof_missing",
  "missing proof must explain why it is not verified"
);
assert.equal(
  missingProofTrace.repoFactsSummary.sourceProof.canAuthorizeWrite,
  false,
  "missing proof must not authorize writes"
);
assert.equal(
  missingProofTrace.repoFactsSummary.sourceProof.canExecute,
  false,
  "missing proof must not execute actions"
);

console.log("Smoke Human decision trace source proof — OK");
