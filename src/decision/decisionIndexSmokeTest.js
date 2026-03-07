/**
 * Decision Index Smoke Test
 *
 * Responsibility:
 * - verifies that Decision Layer index exports work correctly
 * - runs minimal smoke checks for planner service and runner
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 */

import {
  decisionPlannerService,
  decisionServiceRunner,
  runDecisionServiceRunnerSandboxTest,
} from "./index.js";

export async function runDecisionIndexSmokeTest(input = {}) {
  const goal =
    input.goal ||
    input.text ||
    input.command ||
    "analyze repository structure and propose next step";

  const safeInput = {
    goal,
    transport: "sandbox",
    userId: "smoke-user",
    chatId: "smoke-chat",
    messageId: "smoke-message",
    meta: {
      source: "decision_index_smoke_test",
    },
  };

  const plannerResult = await decisionPlannerService.runAll(safeInput);

  const runnerResult = await decisionServiceRunner.run(safeInput);

  const sandboxRunnerTest = await runDecisionServiceRunnerSandboxTest(safeInput);

  return {
    ok:
      Boolean(plannerResult?.ok) &&
      Boolean(runnerResult?.ok) &&
      Boolean(sandboxRunnerTest?.ok),

    mode: "decision_index_smoke_test",

    planner: plannerResult,
    runner: runnerResult,
    sandboxRunnerTest,
  };
}