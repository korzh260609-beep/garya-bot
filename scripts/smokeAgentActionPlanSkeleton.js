// AGENT NOTE:
// Smoke test for SG 2.0 agent action plan skeleton.
// Purpose: verify intent-to-action-plan remains safe and non-executing.
// This script must not call Telegram, Render, GitHub, DB, OpenAI, network, or external services.

import assert from "node:assert/strict";
import { buildAgentIntentDecision } from "../src/agents/shared/intent/index.js";
import { AgentActionPlanService, buildAgentActionPlan } from "../src/agents/shared/action-plan/index.js";

function assertPlanSafe(plan) {
  assert.equal(plan.executionAllowed, false, "action plan must not allow execution");
  assert.equal(plan.requiresApproval, true, "action plan must require approval");
  assert.equal(plan.canChangeState, false, "action plan must not change state");
  assert.equal(plan.tokensSpent, false, "action plan must not spend tokens");
  assert.equal(plan.safety.planOnly, true, "action plan must be plan-only");
  assert.equal(plan.safety.connectedToRuntime, false, "action plan must not connect to runtime");
  assert.equal(plan.safety.connectedToTelegram, false, "action plan must not connect to Telegram");
  assert.equal(plan.safety.connectedToRender, false, "action plan must not connect to Render");
  assert.equal(plan.safety.connectedToGitHub, false, "action plan must not connect to GitHub");
  assert.equal(plan.safety.connectedToDatabase, false, "action plan must not connect to DB");
  assert.equal(plan.safety.connectedToAI, false, "action plan must not connect to AI");
  assert.equal(plan.safety.connectedToNetwork, false, "action plan must not connect to network");
  assert.equal(plan.safety.executesAgents, false, "action plan must not execute agents");
  assert.equal(plan.safety.executesRequests, false, "action plan must not execute requests");
  assert.equal(plan.safety.writesFilesystem, false, "action plan must not write filesystem");
  assert.equal(plan.safety.writesRepository, false, "action plan must not write repository");
  assert.equal(plan.safety.isKeywordRouter, false, "action plan must not be keyword-router");
  assert.equal(plan.safety.isTechnicalMode, false, "action plan must not be technical mode");

  for (const step of plan.steps) {
    assert.equal(step.execute, false, `plan step ${step.order} must not execute`);
  }
}

function runIntentToActionPlanSmoke() {
  const renderDecision = buildAgentIntentDecision({
    message: "СГ, проверь Render, бот не отвечает, нужны последние логи",
    metadata: {
      source: "action-plan-smoke",
    },
  });

  const renderPlan = buildAgentActionPlan({
    decision: renderDecision,
    metadata: {
      source: "action-plan-smoke",
    },
  });

  assert.equal(renderPlan.status, "planned", "render logs intent should produce planned status");
  assert.equal(renderPlan.planType, "collect_facts_plan", "render logs intent should produce collect facts plan");
  assert.equal(renderPlan.suggestedAgentId, "render-logs-collector", "render logs plan should target render collector");
  assert.equal(renderPlan.suggestedAction, "get_latest_logs", "render logs plan should target latest logs action");
  assert.equal(renderPlan.registeredAgentFound, true, "render collector should be registered");
  assert.equal(renderPlan.agentConfigFound, true, "render collector config should exist");
  assert.equal(renderPlan.actionAllowedByConfig, true, "render latest logs action should be allowlisted");
  assertPlanSafe(renderPlan);

  const inventoryDecision = buildAgentIntentDecision({
    message: "СГ, что у нас сейчас по агентам?",
  });
  const inventoryPlan = buildAgentActionPlan({ decision: inventoryDecision });

  assert.equal(inventoryPlan.status, "planned", "inventory intent should produce planned status");
  assert.equal(inventoryPlan.planType, "build_report_plan", "inventory intent should produce report plan");
  assert.equal(inventoryPlan.suggestedAgentId, "agent-inventory-agent", "inventory plan should target inventory agent");
  assert.equal(inventoryPlan.actionAllowedByConfig, true, "inventory action should be allowlisted");
  assertPlanSafe(inventoryPlan);

  const unknownPlan = buildAgentActionPlan({
    decision: {
      intentType: "unknown",
      suggestedAgentId: null,
      suggestedAction: null,
    },
  });

  assert.equal(unknownPlan.status, "blocked", "unknown intent should produce blocked plan");
  assert.equal(unknownPlan.planType, "unknown", "unknown intent should keep unknown plan type");
  assert.equal(unknownPlan.executionAllowed, false, "unknown plan must not execute");
  assertPlanSafe(unknownPlan);
}

function runAgentActionPlanServiceSmoke() {
  const decision = buildAgentIntentDecision({
    message: "Что дальше по проекту?",
  });
  const service = new AgentActionPlanService();
  const result = service.buildPlan({ decision });

  assert.equal(result.ok, true, "agent action plan service should return ok=true");
  assert.equal(result.agent, "agent-action-plan", "agent action plan service should identify itself");
  assert.equal(result.canChangeState, false, "agent action plan service must not change state");
  assert.equal(result.tokensSpent, false, "agent action plan service must not spend tokens");
  assert.equal(result.metadata.planOnly, true, "agent action plan service must be plan-only");
  assert.equal(result.metadata.executionAllowed, false, "agent action plan service must not allow execution");
  assert.equal(result.metadata.connectedToRuntime, false, "agent action plan service must not connect to runtime");
  assert.equal(result.metadata.connectedToAI, false, "agent action plan service must not connect to AI");
  assert.equal(result.metadata.executesAgents, false, "agent action plan service must not execute agents");
  assert.equal(result.metadata.isKeywordRouter, false, "agent action plan service must not be keyword-router");
  assert.equal(result.metadata.isTechnicalMode, false, "agent action plan service must not be technical mode");
  assert.equal(result.data.actionPlan.suggestedAgentId, "repo-state-agent", "next-step plan should suggest repo-state agent");
  assertPlanSafe(result.data.actionPlan);
}

runIntentToActionPlanSmoke();
runAgentActionPlanServiceSmoke();

console.log("SG 2.0 agent action plan skeleton smoke: OK");
