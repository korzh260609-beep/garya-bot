// scripts/smokeProjectMemoryAutoConfirmationPolicy.js

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS,
  buildProjectMemoryAutoConfirmationPolicyStatus,
  evaluateProjectMemoryAutoConfirmation,
} from "../src/memory/index.js";

function expectAllow(result) {
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.autoConfirm, true);
  assert.equal(result.decision, PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS.ALLOW);
  assert.equal(result.boundaries.writesStorage, false);
  assert.equal(result.boundaries.callsAI, false);
  assert.equal(result.boundaries.touchesTelegram, false);
}

function expectDeny(result, reason) {
  assert.equal(result.ok, true);
  assert.equal(result.allowed, false);
  assert.equal(result.autoConfirm, false);
  assert.equal(result.decision, PROJECT_MEMORY_AUTO_CONFIRMATION_DECISIONS.DENY);
  assert.equal(result.reason, reason);
  assert.equal(result.boundaries.writesStorage, false);
  assert.equal(result.boundaries.callsAI, false);
  assert.equal(result.boundaries.touchesTelegram, false);
}

const status = buildProjectMemoryAutoConfirmationPolicyStatus();
assert.equal(status.ok, true);
assert.equal(status.boundaries.purePolicyEvaluationOnly, true);
assert.equal(status.boundaries.writesStorage, false);

expectAllow(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED,
  event: {
    eventType: "pr_merged",
    sourceRef: "pr-316",
    metadata: {
      repositoryFullName: "korzh260609-beep/garya-bot",
      baseBranch: "dev/v2-start",
      headSha: "abc123",
    },
  },
}));

expectAllow(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
  evidence: {
    eventType: "deploy_ok",
    sourceRef: "render-clean-deploy",
    verified: true,
    deployOk: true,
    logsClean: true,
  },
}));

expectDeny(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RAW_CHAT,
  event: { sourceRef: "chat-message" },
}), "raw_chat_source_denied");

expectDeny(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED,
  event: {
    eventType: "pr_merged",
    sourceRef: "pr-1",
    metadata: {
      repositoryFullName: "korzh260609-beep/garya-bot",
      baseBranch: "main",
      headSha: "abc123",
    },
  },
}), "wrong_branch");

expectDeny(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED,
  event: {
    eventType: "pr_merged",
    metadata: {
      repositoryFullName: "korzh260609-beep/garya-bot",
      baseBranch: "dev/v2-start",
      headSha: "abc123",
    },
  },
}), "missing_source_ref");

expectDeny(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.GITHUB_PR_MERGED,
  event: {
    eventType: "pr_merged",
    sourceRef: "pr-317",
    metadata: {
      repositoryFullName: "korzh260609-beep/garya-bot",
      baseBranch: "dev/v2-start",
    },
  },
}), "weak_evidence");

expectDeny(evaluateProjectMemoryAutoConfirmation({
  sourceKind: PROJECT_MEMORY_AUTO_CONFIRMATION_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
  evidence: {
    eventType: "deploy_ok",
    sourceRef: "render-dirty-deploy",
    verified: true,
    deployOk: true,
    logsClean: false,
  },
}), "render_evidence_not_verified");

console.log("smoke:project-memory-auto-confirmation-policy ok");
