/**
 * Decision Planner Service Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Planner Service
 * - runs service.runAll() with safe sandbox input
 * - returns unified planner service result
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external actions
 */

import decisionPlannerService from "./decisionPlannerService.js";

export async function runDecisionPlannerServiceSandboxTest(input = {}) {
  const testInput = {
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
    meta: input.meta || {
      source: "decision_planner_service_sandbox_test",
    },
  };

  const result = await decisionPlannerService.runAll(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    result,
  };
}