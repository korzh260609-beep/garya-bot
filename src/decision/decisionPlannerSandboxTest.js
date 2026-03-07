/**
 * Decision Planner Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Planner
 * - runs planDecision() with test input
 * - returns structured planning result
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external actions
 */

import { planDecision } from "./decisionPlanner.js";

export async function runDecisionPlannerSandboxTest(input = {}) {
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
      source: "decision_planner_sandbox_test",
    },
  };

  const result = await planDecision(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    result,
  };
}