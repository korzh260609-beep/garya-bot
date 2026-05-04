// AGENT NOTE:
// Smoke test for SG 2.0 agent approval gate skeleton.
// Purpose: verify action-plan-to-approval-gate remains safe and non-executing.
// This script must not call Telegram, Render, GitHub, DB, OpenAI, network, or external services.

import assert from "node:assert/strict";
import { buildAgentIntentDecision } from "../src/agents/shared/intent/index.js";
import { buildAgentActionPlan } from "../src/agents/shared/action-plan/index.js";
import {
  AgentApprovalGateService,
  buildAgentApprovalDecision,
} from "../src/agents/shared/approval-gate/index.js";

function assertApprovalSafe(approvalDecision) {
  assert.equal(approvalDecision.executionAllowed, false, "approval gate must not allow execution");
  assert.equal(approvalDecision.canAuthorizeExecution, false, "approval gate must not authorize execution");
  assert.equal(approvalDecision.canChangeState, false, "approval gate must not change state");
  assert.equal(approvalDecision.tokensSpent, false, "approval gate must not spend tokens");
  assert.equal(approvalDecision.safety.approvalGateOnly, true, "approval gate must be approval-gate-only");
  assert.equal(approvalDecision.safety.planOnly, true, "approval gate must be plan-only");
  assert.equal(approvalDecision.safety.decisionOnly, true, "approval gate must be decision-only");
  assert.equal(approvalDecision.safety.connectedToRuntime, false, "approval gate must not connect to runtime");
  assert.equal(approvalDecision.safety.connectedToTelegram, false, "approval gate must not connect to Telegram");
  assert.equal(approvalDecision.safety.connectedToRender, false, "approval gate must not connect to Render");
  assert.equal(approvalDecision.safety.connectedToGitHub, false, "approval gate must not connect to GitHub");
  assert.equal(approvalDecision.safety.connectedToDatabase, false, "approval gate must not connect to DB");
  assert.equal(approvalDecision.safety.connectedToAI, false, "approval gate must not connect to AI");
  assert.equal(approvalDecision.safety.connectedToNetwork, false, "approval gate must not connect to network");
  assert.equal(approvalDecision.safety.executesAgents, false, "approval gate must not execute agents");
  assert.equal(approvalDecision.safety.executesRequests, false, "approval gate must not execute requests");
  assert.equal(approvalDecision.safety.writesFilesystem, false, "approval gate must not write filesystem");
  assert.equal(approvalDecision.safety.writesRepository, false, "approval gate must not write repository");
  assert.equal(approvalDecision.safety.isKeywordRouter, false, "approval gate must not be keyword-router");
  assert.equal(approvalDecision.safety.isTechnicalMode, false, "approval gate must not be technical mode");
}

function runApprovalGateBuilderSmoke() {
  const decision = buildAgentIntentDecision({
    message: "СГ, проверь Render, бот не отвечает, нужны последние логи",
    metadata: {
      source: "approval-gate-smoke",
    },
  });

  const actionPlan = buildAgentActionPlan({
    decision,
    metadata: {
      source: "approval-gate-smoke",
    },
  });

  const noCommandDecision = buildAgentApprovalDecision({
    actionPlan,
    requester: {
      role: "monarch",
    },
    approvalCommand: "",
  });

  assert.equal(noCommandDecision.status, "pending_approval", "missing МОЖНО from monarch should keep plan pending");
  assert.equal(noCommandDecision.decision, "require_monarch_approval", "missing МОЖНО should require monarch approval");
  assert.equal(noCommandDecision.approvalCommandProvided, false, "missing command should be recorded as not provided");
  assert.equal(noCommandDecision.approvalGiven, false, "missing МОЖНО must not count as approval");
  assert.equal(noCommandDecision.blockingReasons.length, 0, "pending monarch approval should not be treated as blocked");
  assertApprovalSafe(noCommandDecision);

  const invalidCommandDecision = buildAgentApprovalDecision({
    actionPlan,
    requester: {
      role: "monarch",
    },
    approvalCommand: "можно, но не точно",
  });

  assert.equal(invalidCommandDecision.status, "blocked", "invalid approval command must block approval");
  assert.equal(invalidCommandDecision.decision, "block_execution", "invalid approval command must block execution path");
  assert.equal(invalidCommandDecision.approvalCommandProvided, true, "invalid command should still be recorded as provided");
  assert.equal(invalidCommandDecision.approvalGiven, false, "invalid command must not count as approval");
  assertApprovalSafe(invalidCommandDecision);

  const nullRequesterDecision = buildAgentApprovalDecision({
    actionPlan,
    requester: null,
    approvalCommand: "МОЖНО",
  });

  assert.equal(nullRequesterDecision.status, "blocked", "null requester must not approve plan");
  assert.equal(nullRequesterDecision.requesterRole, "unknown", "null requester should normalize to unknown role");
  assert.equal(nullRequesterDecision.decision, "block_execution", "null requester must block execution path");
  assertApprovalSafe(nullRequesterDecision);

  const guestDecision = buildAgentApprovalDecision({
    actionPlan,
    requester: {
      role: "guest",
    },
    approvalCommand: "МОЖНО",
  });

  assert.equal(guestDecision.status, "blocked", "guest МОЖНО must not approve plan");
  assert.equal(guestDecision.decision, "block_execution", "guest approval must be blocked");
  assert.equal(guestDecision.approvedBy, null, "guest must not be recorded as approver");
  assertApprovalSafe(guestDecision);

  const monarchDecision = buildAgentApprovalDecision({
    actionPlan,
    requester: {
      role: "monarch",
    },
    approvalCommand: "МОЖНО",
  });

  assert.equal(monarchDecision.status, "approved", "monarch МОЖНО should approve plan-only gate");
  assert.equal(monarchDecision.decision, "allow_plan_only", "monarch approval should be plan-only");
  assert.equal(monarchDecision.approvedBy, "monarch", "monarch should be recorded as plan approver");
  assert.equal(monarchDecision.executionAllowed, false, "approved gate must still not allow execution");
  assertApprovalSafe(monarchDecision);

  const blockedPlanDecision = buildAgentApprovalDecision({
    actionPlan: {
      status: "blocked",
      executionAllowed: false,
      requiresApproval: true,
    },
    requester: {
      role: "monarch",
    },
    approvalCommand: "МОЖНО",
  });

  assert.equal(blockedPlanDecision.status, "blocked", "blocked action plan must stay blocked");
  assert.equal(blockedPlanDecision.decision, "block_unknown_plan", "blocked action plan should be treated as unknown/unsafe");
  assertApprovalSafe(blockedPlanDecision);
}

function runApprovalGateServiceSmoke() {
  const decision = buildAgentIntentDecision({
    message: "Что дальше по проекту?",
  });
  const actionPlan = buildAgentActionPlan({ decision });
  const service = new AgentApprovalGateService();
  const result = service.reviewPlan({
    actionPlan,
    requester: {
      role: "monarch",
    },
    approvalCommand: "МОЖНО",
  });

  assert.equal(result.ok, true, "agent approval gate service should return ok=true");
  assert.equal(result.agent, "agent-approval-gate", "agent approval gate service should identify itself");
  assert.equal(result.canChangeState, false, "agent approval gate service must not change state");
  assert.equal(result.tokensSpent, false, "agent approval gate service must not spend tokens");
  assert.equal(result.metadata.approvalGateOnly, true, "agent approval gate service must be approval-gate-only");
  assert.equal(result.metadata.executionAllowed, false, "agent approval gate service must not allow execution");
  assert.equal(result.metadata.canAuthorizeExecution, false, "agent approval gate service must not authorize execution");
  assert.equal(result.metadata.connectedToRuntime, false, "agent approval gate service must not connect to runtime");
  assert.equal(result.metadata.connectedToAI, false, "agent approval gate service must not connect to AI");
  assert.equal(result.metadata.executesAgents, false, "agent approval gate service must not execute agents");
  assert.equal(result.metadata.isKeywordRouter, false, "agent approval gate service must not be keyword-router");
  assert.equal(result.metadata.isTechnicalMode, false, "agent approval gate service must not be technical mode");
  assert.equal(result.data.approvalDecision.decision, "allow_plan_only", "service should approve plan-only when monarch says МОЖНО");
  assertApprovalSafe(result.data.approvalDecision);
}

runApprovalGateBuilderSmoke();
runApprovalGateServiceSmoke();

console.log("SG 2.0 agent approval gate skeleton smoke: OK");
