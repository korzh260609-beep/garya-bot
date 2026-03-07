/**
 * Decision Router
 *
 * Responsibility:
 * - accepts normalized Decision Context
 * - returns normalized Decision Route
 * - contains ONLY sandbox skeleton logic
 * - does NOT connect to production pipeline
 * * Expected context shape:
 * {
 *   text?: string | null,
 *   command?: string | null,
 *   transport?: string | null,
 *   userId?: string | number | null,
 *   chatId?: string | number | null,
 *   messageId?: string | number | null,
 *   meta?: object,
 *   timestamp?: number,
 * }
 */

import { DECISION_KIND } from "./decisionTypes.js";

export function createDecisionRoute(data = {}) {
  return {
    kind: data.kind || DECISION_KIND.UNKNOWN,
    needsAI: data.needsAI || false,
    workerType: data.workerType || "none",
    judgeRequired: data.judgeRequired || false,
    reason: data.reason || "not_defined",
  };
}

export async function routeDecision(context = {}) {
  const text = typeof context.text === "string" ? context.text.trim() : "";
  const command =
    typeof context.command === "string" ? context.command.trim() : "";

  if (command) {
    return createDecisionRoute({
      kind: DECISION_KIND.TASK_EXECUTION,
      needsAI: false,
      workerType: "command",
      judgeRequired: false,
      reason: "command_detected",
    });
  }

  if (!text) {
    return createDecisionRoute({
      kind: DECISION_KIND.UNKNOWN,
      needsAI: false,
      workerType: "none",
      judgeRequired: false,
      reason: "empty_input",
    });
  }

  return createDecisionRoute({
    kind: DECISION_KIND.CHAT_SIMPLE,
    needsAI: false,
    workerType: "basic",
    judgeRequired: true,
    reason: "default_sandbox_route",
  });
}