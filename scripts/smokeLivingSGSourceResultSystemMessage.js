// scripts/smokeLivingSGSourceResultSystemMessage.js
// ============================================================================
// Smoke — Living SG Source Result System Message
//
// Verifies that the builder converts sourceResult envelopes into prompt-safe
// system evidence without executing anything, and that confirmed repo
// projectMap payload facts are passed into the prompt for source-only answers.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";
import {
  buildLivingSourceResultSystemMessage,
} from "../src/core/living-sg/LivingSourceResultSystemMessage.js";

function assertSystemEvidenceSafety(message) {
  assert.equal(message.role, "system", "source result evidence must be a system message");
  assert.ok(
    message.content.includes("SOURCE RESULT SYSTEM EVIDENCE:"),
    "message must be marked as source result system evidence"
  );
  assert.ok(
    message.content.includes("canAuthorizeWrite=false"),
    "message must never authorize writes"
  );
  assert.ok(
    message.content.includes("does not execute sources"),
    "message must say it does not execute sources"
  );
  assert.ok(
    message.content.includes("read repositories"),
    "message must say it does not read repositories"
  );
  assert.ok(
    message.content.includes("A confirmed read result never authorizes write actions"),
    "message must separate read proof from write authority"
  );
}

const confirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    path: "package.json",
    scope: "repo_file",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-01T19:00:00Z",
  sourceUpdatedAt: "2026-05-01T18:45:00Z",
  payload: { path: "package.json", sha: "example-sha" },
  valid: true,
  confirmed: true,
  confirmedBy: "runtime-source",
  reason: "runtime_source_result_confirmed",
});

const confirmedMessage = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: confirmedEnvelope,
});

assertSystemEvidenceSafety(confirmedMessage);
assert.ok(confirmedMessage.content.includes("status=confirmed"));
assert.ok(confirmedMessage.content.includes("verified=true"));
assert.ok(confirmedMessage.content.includes("canClaimVerifiedFacts=true"));
assert.ok(confirmedMessage.content.includes("kind=repo"));
assert.ok(confirmedMessage.content.includes("repository=korzh260609-beep/garya-bot"));
assert.ok(
  confirmedMessage.content.includes("may support verified repository/source claims only for the stated target")
);

const confirmedProjectMapEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    scope: "repo_state_agent_project_map",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-02T13:55:00Z",
  sourceUpdatedAt: "2026-05-02T13:54:00Z",
  payload: {
    projectMap: {
      repo: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "main",
        headCommitSha: "abc123",
      },
      totals: {
        files: 127,
        modules: 9,
        dependencies: 42,
        contentLoaded: 80,
        contentSkipped: 47,
        hiddenFiles: 0,
        structureComplete: true,
      },
      layers: {
        core: {
          filesCount: 33,
          sampleFiles: [
            "src/core/handleMessage/handleChatFlow.js",
            "src/core/living-sg/LivingSourceResultSystemMessage.js",
          ],
        },
        transport: {
          filesCount: 12,
          sampleFiles: ["src/bot/handlers/chat/sourceFlow.js"],
        },
      },
      modules: [
        {
          key: "src/core",
          rootPath: "src/core",
          layer: "core",
          filesCount: 33,
          sampleFiles: ["src/core/handleMessage/legacyProjectIntentFlow.js"],
        },
      ],
      entrypoints: [
        { path: "index.js" },
        { path: "src/http/server.js" },
      ],
      criticalFiles: [
        { path: "index.js" },
        { path: "pillars/DECISIONS.md" },
      ],
    },
  },
  valid: true,
  confirmed: true,
  confirmedBy: "LivingRepoSourceProviderResultAdapter",
  reason: "provider_result_confirmed_and_adapted",
});

const projectMapMessage = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: confirmedProjectMapEnvelope,
});

assertSystemEvidenceSafety(projectMapMessage);
assert.ok(projectMapMessage.content.includes("REPO FACTS FROM SOURCE PAYLOAD:"));
assert.ok(projectMapMessage.content.includes("repo.fullName=korzh260609-beep/garya-bot"));
assert.ok(projectMapMessage.content.includes("repo.branch=main"));
assert.ok(projectMapMessage.content.includes("repo.headCommitSha=abc123"));
assert.ok(projectMapMessage.content.includes("totals.files=127"));
assert.ok(projectMapMessage.content.includes("totals.modules=9"));
assert.ok(projectMapMessage.content.includes("totals.dependencies=42"));
assert.ok(projectMapMessage.content.includes("totals.structureComplete=true"));
assert.ok(projectMapMessage.content.includes("layers:"));
assert.ok(projectMapMessage.content.includes("- core: files=33"));
assert.ok(projectMapMessage.content.includes("src/core/handleMessage/handleChatFlow.js"));
assert.ok(projectMapMessage.content.includes("modules:"));
assert.ok(projectMapMessage.content.includes("- src/core: root=src/core; layer=core; files=33"));
assert.ok(projectMapMessage.content.includes("entrypoints: index.js, src/http/server.js"));
assert.ok(projectMapMessage.content.includes("criticalFiles: index.js, pillars/DECISIONS.md"));
assert.ok(
  projectMapMessage.content.includes("answer only from REPO FACTS FROM SOURCE PAYLOAD above")
);
assert.ok(
  projectMapMessage.content.includes("Do not invent paths, folders, files, technologies, setup files, licenses, tests, docs, or config folders")
);

const missingMessage = buildLivingSourceResultSystemMessage({});

assertSystemEvidenceSafety(missingMessage);
assert.ok(missingMessage.content.includes("status=missing"));
assert.ok(missingMessage.content.includes("verified=false"));
assert.ok(missingMessage.content.includes("sourceResultEnvelopePresent=false"));
assert.ok(
  missingMessage.content.includes("Do not present repository/source facts as verified")
);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: {
    projectMap: {
      repo: { fullName: "korzh260609-beep/garya-bot", branch: "main" },
      totals: { files: 999 },
    },
  },
  valid: true,
  confirmed: true,
});

const staleMessage = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: staleEnvelope,
});

assertSystemEvidenceSafety(staleMessage);
assert.ok(staleMessage.content.includes("status=stale"));
assert.ok(staleMessage.content.includes("verified=false"));
assert.ok(staleMessage.content.includes("canClaimVerifiedFacts=false"));
assert.ok(
  staleMessage.content.includes("not confirmed for verified claims")
);
assert.ok(
  !staleMessage.content.includes("REPO FACTS FROM SOURCE PAYLOAD:"),
  "stale/unverified projectMap payload must not be exposed as verified repo facts"
);
assert.ok(
  !staleMessage.content.includes("totals.files=999"),
  "stale/unverified totals must not be exposed as verified repo facts"
);

console.log("Smoke Living SG Source Result System Message — OK");
