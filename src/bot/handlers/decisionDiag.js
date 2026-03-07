// src/bot/handlers/decisionDiag.js
// Decision Layer diagnostics command handler (sandbox-only, read-only)

import { runDecisionDiagnostics } from "../../decision/index.js";

function fmtJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_) {
    return "{}";
  }
}

function toLines(result = {}) {
  const smokeOk = result?.smoke?.ok === true ? "true ✅" : "false ⛔";

  return [
    "🧠 DECISION DIAG",
    `ok: ${result?.ok === true ? "true ✅" : "false ⛔"}`,
    `mode: ${result?.mode || "unknown"}`,
    `generatedAt: ${result?.meta?.generatedAt || "unknown"}`,
    "",
    `smoke_ok: ${smokeOk}`,
    `decision_total: ${result?.decisionHealth?.total ?? 0}`,
    `decision_error_rate: ${result?.decisionHealth?.decisionErrorRate ?? 0}`,
    `validator_warning_rate: ${result?.decisionHealth?.validatorWarningRate ?? 0}`,
    `judge_approval_rate: ${result?.decisionHealth?.judgeApprovalRate ?? 0}`,
    "",
    `planner_total: ${result?.plannerHealth?.total ?? 0}`,
    `planner_passed: ${result?.plannerHealth?.passed ?? 0}`,
    `planner_failed: ${result?.plannerHealth?.failed ?? 0}`,
    `planner_pass_rate: ${result?.plannerHealth?.passRate ?? 0}`,
    `planner_failure_rate: ${result?.plannerHealth?.failureRate ?? 0}`,
    "",
    `memory_size: ${result?.memory?.size ?? 0}`,
    `memory_limit: ${result?.memory?.limit ?? 0}`,
    `telemetry_size: ${result?.telemetry?.size ?? 0}`,
    "",
    "route_distribution:",
    fmtJson(result?.decisionHealth?.routeDistribution || {}),
    "",
    "worker_reliability:",
    fmtJson(result?.decisionHealth?.workerReliability || {}),
    "",
    "telemetry_stats:",
    fmtJson(result?.telemetry?.stats || {}),
  ];
}

export async function handleDecisionDiag({ bot, chatId, reply, rest }) {
  const input = {
    goal:
      String(rest || "").trim() ||
      "analyze repository structure and propose next step",
    transport: "sandbox",
    meta: {
      source: "bot_command_decision_diag",
    },
  };

  const result = await runDecisionDiagnostics(input);
  const text = toLines(result).join("\n");

  if (typeof reply === "function") {
    await reply(text, { cmd: "/diag_decision", handler: "handleDecisionDiag" });
    return;
  }

  await bot.sendMessage(chatId, text);
}