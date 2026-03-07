/**
 * Decision Diagnostics
 *
 * Responsibility:
 * - provides unified sandbox diagnostics for Decision Layer
 * - aggregates smoke test, runtime health, planner health, memory stats, telemetry stats
 * - does NOT modify production pipeline
 * - does NOT connect into handleMessage
 * - does NOT connect into TelegramAdapter
 *
 * IMPORTANT:
 * - sandbox only
 * - read-only diagnostics
 * - no external side effects
 */

import { runDecisionIndexSmokeTest } from "./decisionIndexSmokeTest.js";
import { getDecisionHealth } from "./decisionHealth.js";
import { getDecisionPlannerHealth } from "./decisionPlannerHealth.js";
import {
  getDecisionMemorySize,
  getDecisionMemoryLimit,
} from "./decisionMemory.js";
import {
  getDecisionTelemetrySize,
  getDecisionTelemetryStats,
} from "./decisionTelemetry.js";

function createMeta() {
  return {
    generatedAt: Date.now(),
    source: "decision_diagnostics",
    mode: "sandbox_only",
  };
}

export async function runDecisionDiagnostics(input = {}) {
  const smoke = await runDecisionIndexSmokeTest(input);
  const decisionHealth = getDecisionHealth();
  const plannerHealth = await getDecisionPlannerHealth();

  const memory = {
    size: getDecisionMemorySize(),
    limit: getDecisionMemoryLimit(),
  };

  const telemetry = {
    size: getDecisionTelemetrySize(),
    stats: getDecisionTelemetryStats(),
  };

  return {
    ok:
      Boolean(smoke?.ok) &&
      Boolean(plannerHealth) &&
      Boolean(decisionHealth),

    mode: "decision_diagnostics",
    meta: createMeta(),

    smoke,
    decisionHealth,
    plannerHealth,
    memory,
    telemetry,
  };
}

const decisionDiagnostics = {
  run: runDecisionDiagnostics,
};

export default decisionDiagnostics;