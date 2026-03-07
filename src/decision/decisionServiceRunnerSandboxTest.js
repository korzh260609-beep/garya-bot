/**
 * Decision Service Runner Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Service Runner
 * - runs runner.run() with safe sandbox input
 * - returns unified decision service result
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external actions
 */

import decisionServiceRunner from "./decisionServiceRunner.js";

export async function runDecisionServiceRunnerSandboxTest(input = {}) {
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
      source: "decision_service_runner_sandbox_test",
    },
  };

  const result = await decisionServiceRunner.run(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    result,
  };
}