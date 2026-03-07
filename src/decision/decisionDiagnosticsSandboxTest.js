/**
 * Decision Diagnostics Sandbox Test
 *
 * Responsibility:
 * - provides isolated sandbox entry for Decision Diagnostics
 * - runs diagnostics.run() with safe sandbox input
 * - attaches safe baseline for replay/compare verification
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

function createSafeBaseline(input = {}) {
  if (input?.baseline && typeof input.baseline === "object") {
    return {
      finalText:
        input.baseline.finalText == null
          ? null
          : String(input.baseline.finalText),
      route: input.baseline.route || null,
      warnings: Array.isArray(input.baseline.warnings)
        ? input.baseline.warnings
        : [],
      source: input.baseline.source || "sandbox_custom",
    };
  }

  return {
    finalText: null,
    route: {
      kind: "sandbox_baseline",
      worker: "baseline_stub",
      judgeRequired: false,
    },
    warnings: [],
    source: "sandbox_demo_baseline",
  };
}

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
    baseline: createSafeBaseline(input),
  };

  const result = await decisionDiagnostics.run(testInput);

  return {
    ok: result?.ok || false,
    testInput,
    baseline: testInput.baseline,
    result,
  };
}