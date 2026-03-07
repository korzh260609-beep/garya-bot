/**
 * Decision Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Layer
 * - runs executeDecision() with test input
 * - returns structured result
 *
 * IMPORTANT:
 * - sandbox only
 * * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external actions
 */

import { executeDecision } from "./decisionExecutor.js";

export async function runDecisionSandboxTest(input = {}) {
  const testInput = {
    text: input.text || "sandbox test message",
    command: input.command || null,
    transport: input.transport || "sandbox",
    userId: input.userId || "sandbox-user",
    chatId: input.chatId || "sandbox-chat",
    messageId: input.messageId || "sandbox-message",
    meta: input.meta || {
      source: "decision_sandbox_test",
    },
  };

  const result = await executeDecision(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    result,
  };
}