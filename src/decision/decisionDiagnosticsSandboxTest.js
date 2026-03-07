/**
 * Decision Diagnostics Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Diagnostics
 * - runs diagnostics.run() with safe sandbox input
 * - returns unified diagnostics result
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external actions
 */

import decisionDiagnostics from "./decisionDiagnostics.js";

export async function runDecisionDiagnosticsSandboxTest(input = {}) {
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
      source: "decision_diagnostics_sandbox_test",
    },
  };

  const result = await decisionDiagnostics.run(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    result,
  };
}