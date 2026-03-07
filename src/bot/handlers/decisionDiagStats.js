// src/bot/handlers/decisionDiagStats.js
// Read-only aggregate diagnostics for Decision telemetry + health

import {
  getDecisionTelemetryStats,
  getDecisionTelemetrySize,
  getDecisionHealth,
} from "../../decision/index.js";

function fmtJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_) {
    return "{}";
  }
}

function buildText() {
  const telemetryStats = getDecisionTelemetryStats();
  const telemetrySize = getDecisionTelemetrySize();
  const health = getDecisionHealth();

  return [
    "🧠 DECISION STATS",
    `telemetry_size: ${telemetrySize}`,
    `decision_total: ${telemetryStats?.total ?? 0}`,
    "",
    "compare:",
    `shadow_better: ${telemetryStats?.shadowBetter ?? 0}`,
    `baseline_better: ${telemetryStats?.baselineBetter ?? 0}`,
    `equal: ${telemetryStats?.equal ?? 0}`,
    `same_final_text: ${telemetryStats?.sameFinalText ?? 0}`,
    `same_route: ${telemetryStats?.sameRoute ?? 0}`,
    `avg_duration_ms: ${telemetryStats?.avgDurationMs ?? 0}`,
    "",
    "health:",
    `decision_error_rate: ${health?.decisionErrorRate ?? 0}`,
    `validator_warning_rate: ${health?.validatorWarningRate ?? 0}`,
    `judge_approval_rate: ${health?.judgeApprovalRate ?? 0}`,
    "",
    "route_distribution:",
    fmtJson(health?.routeDistribution || {}),
    "",
    "worker_reliability:",
    fmtJson(health?.workerReliability || {}),
  ].join("\n");
}

export async function handleDecisionDiagStats({ bot, chatId, reply }) {
  const text = buildText();

  if (typeof reply === "function") {
    await reply(text, {
      cmd: "/diag_decision_stats",
      handler: "handleDecisionDiagStats",
    });
    return;
  }

  await bot.sendMessage(chatId, text);
}