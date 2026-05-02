// scripts/smokeLivingRepoStateAgentProviderResult.js
// ============================================================================
// Smoke — Living RepoStateAgent Provider Result Adapter
//
// Verifies that an already-obtained RepoStateAgent fastReadOnly result can be
// converted into a Living providerResult and then into a confirmed source result
// envelope without executing RepoStateAgent from Living SG.
// ============================================================================

import assert from "node:assert/strict";

import {
  adaptRepoStateAgentResultToLivingProviderResult,
  LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS,
} from "../src/core/living-sg/LivingRepoStateAgentProviderResult.js";
import {
  adaptLivingRepoSourceProviderResult,
  LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS,
} from "../src/core/living-sg/LivingRepoSourceProviderResultAdapter.js";
import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "../src/core/living-sg/LivingRepoSourceProviderBoundary.js";

const projectMap = {
  schemaVersion: 6,
  generatedAt: "2026-05-02T12:00:00.000Z",
  repo: {
    fullName: "korzh260609-beep/garya-bot",
    branch: "main",
    commitSha: "abc123",
    headCommitSha: "abc123",
  },
  totals: {
    files: 10,
    modules: 3,
    dependencies: 4,
  },
  semanticMap: {
    schemaVersion: 5,
    generatedBy: "deterministic_semantic_map_v5",
    tokensSpent: false,
    taskRoutingHints: [],
    boundaryRules: [],
  },
};

const freshRepoStateAgentResult = {
  ok: true,
  source: "repo_state_agent_fast_read_only",
  fastReadOnly: true,
  repoFullName: "korzh260609-beep/garya-bot",
  branch: "main",
  persistence: {
    readOnly: true,
    writesSkipped: true,
    reusedProjectMapStateId: 7,
  },
  projectMap,
  nextActionPlan: { schemaVersion: 1, tokensSpent: false },
  architectureHealth: { schemaVersion: 1, score: 90, tokensSpent: false },
  aiMeta: {
    fastReadOnly: true,
    reusedProjectMapState: true,
    tokensSpent: false,
    freshness: {
      checked: true,
      ok: true,
      reason: "repo_head_read",
      cachedCommitSha: "abc123",
      currentHeadCommitSha: "abc123",
      headReadError: null,
    },
  },
};

const adapted = adaptRepoStateAgentResultToLivingProviderResult({
  repoStateAgentResult: freshRepoStateAgentResult,
  scope: "repo_state_agent_project_map",
});

assert.equal(adapted.ok, true, "fresh RepoStateAgent result must adapt successfully");
assert.equal(
  adapted.status,
  LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.ADAPTED,
  "fresh RepoStateAgent result must return ADAPTED status"
);
assert.equal(
  adapted.providerKind,
  LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
  "provider kind must be repo_state_agent_provider"
);
assert.equal(adapted.providerResult.confirmed, true, "fresh provider result must be confirmed");
assert.equal(adapted.providerResult.readOnly, true, "provider result must be read-only");
assert.equal(adapted.providerResult.canAuthorizeWrite, false, "provider result must not authorize writes");
assert.equal(adapted.providerResult.canExecute, false, "provider result must not execute");
assert.equal(
  adapted.providerResult.payload.projectMap.semanticMap.generatedBy,
  "deterministic_semantic_map_v5",
  "semantic map must be carried into provider payload"
);
assert.equal(
  adapted.metadata.noRepoStateAgentRuntime,
  true,
  "adapter must not run RepoStateAgent runtime"
);

const envelopeAdapter = adaptLivingRepoSourceProviderResult({
  providerKind: adapted.providerKind,
  providerResult: adapted.providerResult,
});

assert.equal(envelopeAdapter.ok, true, "confirmed provider result must adapt to verified envelope");
assert.equal(
  envelopeAdapter.status,
  LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.ADAPTED_TO_ENVELOPE,
  "provider result adapter must return ADAPTED_TO_ENVELOPE"
);
assert.equal(
  envelopeAdapter.sourceResultEnvelope.canClaimVerifiedFacts,
  true,
  "fresh confirmed envelope may claim verified facts"
);
assert.equal(
  envelopeAdapter.sourceResultEnvelope.payload.semanticMap.generatedBy,
  "deterministic_semantic_map_v5",
  "verified envelope must expose semantic map payload"
);
assert.equal(
  envelopeAdapter.sourceResultEnvelope.canAuthorizeWrite,
  false,
  "verified envelope must not authorize writes"
);
assert.equal(
  envelopeAdapter.sourceResultEnvelope.canExecute,
  false,
  "verified envelope must not execute actions"
);

const staleResult = adaptRepoStateAgentResultToLivingProviderResult({
  repoStateAgentResult: {
    ...freshRepoStateAgentResult,
    aiMeta: {
      ...freshRepoStateAgentResult.aiMeta,
      freshness: {
        checked: true,
        ok: false,
        reason: "repo_head_read",
        cachedCommitSha: "abc123",
        currentHeadCommitSha: "def456",
      },
    },
  },
});

assert.equal(staleResult.ok, false, "stale RepoStateAgent result must not be verified");
assert.equal(
  staleResult.status,
  LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.STALE_OR_UNVERIFIED,
  "stale RepoStateAgent result must return stale/unverified status"
);
assert.equal(staleResult.providerResult.confirmed, false, "stale provider result must not be confirmed");
assert.equal(staleResult.providerResult.payload, null, "stale provider result must not expose payload");

const missingResult = adaptRepoStateAgentResultToLivingProviderResult({});
assert.equal(missingResult.ok, false, "missing RepoStateAgent result must fail");
assert.equal(
  missingResult.status,
  LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.MISSING_RESULT,
  "missing RepoStateAgent result must return missing status"
);

console.log("Smoke Living RepoStateAgent provider result adapter — OK");
