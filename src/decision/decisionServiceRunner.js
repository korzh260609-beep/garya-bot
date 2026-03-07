/**
 * Decision Layer Service Runner
 *
 * Responsibility:
 * - provides single sandbox entry for Decision Layer service flow
 * - orchestrates planner service modules through one runner
 * - does NOT connect into production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify TelegramAdapter
 *
 * Flow:
 * planner
 * -> replay
 * -> compare
 * -> telemetry
 * -> health
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 * - no routing changes
 * - no side effects outside planner telemetry
 */

import decisionPlannerService from "./decisionPlannerService.js";

function createSafeInput(input = {}) {
  return {
    goal:
      input.goal ||
      input.text ||
      input.command ||
      "analyze repository structure and propose next step",
    text: input.text || null,
    command: input.command || null,
    transport: input.transport || "sandbox",
    userId: input.userId || "sandbox-user",
    chatId: input.chatId || "sandbox-chat",
    messageId: input.messageId || "sandbox-message",
    meta: {
      source: "decision_service_runner",
      ...(input.meta || {}),
    },
  };
}

export async function runDecisionLayerServices(input = {}) {
  const safeInput = createSafeInput(input);
  const plannerResult = await decisionPlannerService.runAll(safeInput);

  return {
    ok: Boolean(plannerResult?.ok),
    mode: "decision_service_runner",
    input: safeInput,
    planner: plannerResult,
  };
}

const decisionServiceRunner = {
  run: runDecisionLayerServices,
};

export default decisionServiceRunner;