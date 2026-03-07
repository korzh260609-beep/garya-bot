/**
 * Decision Diagnostics
 *
 * Responsibility:
 * - provides unified sandbox diagnostics for Decision Layer
 * - aggregates smoke test, runtime health, planner health, memory stats, telemetry stats
 * - runs shadow replay + compare in sandbox-only mode
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
import { runDecisionReplay } from "./decisionReplay.js";
import { analyzeDecisionReplay } from "./decisionCompare.js";

function createMeta() {
  return {
    generatedAt: Date.now(),
    source: "decision_diagnostics",
    mode: "sandbox_only",
  };
}

function createBaseline(input = {}) {
  return input?.baseline || {
    finalText: null,
    route: null,
    warnings: [],
    source: "core_stub",
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

  const baseline = createBaseline(input);
  const replay = await runDecisionReplay(input, baseline);
  const analysis = analyzeDecisionReplay(replay);

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

    shadowCompare: {
      replay,
      analysis,
    },
  };
}

const decisionDiagnostics = {
  run: runDecisionDiagnostics,
};

export default decisionDiagnostics;