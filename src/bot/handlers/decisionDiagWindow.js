// src/bot/handlers/decisionDiagWindow.js
// Read-only diagnostics for Decision Shadow Window

import { evaluateDecisionShadowWindow } from "../../decision/decisionShadowWindow.js";

function buildText(stats) {
  if (!stats || stats.total === 0) {
    return [
      "🧠 DECISION SHADOW WINDOW",
      "status: empty",
      "reason: no telemetry yet",
    ].join("\n");
  }

  return [
    "🧠 DECISION SHADOW WINDOW",
    `window_size: ${stats.windowSize}`,
    `total: ${stats.total}`,
    "",
    "results:",
    `shadow_better: ${stats.shadowBetter} (${stats.shadowBetterPercent}%)`,
    `baseline_better: ${stats.baselineBetter} (${stats.baselineBetterPercent}%)`,
    `equal: ${stats.equal} (${stats.equalPercent}%)`,
  ].join("\n");
}

export async function handleDecisionDiagWindow({ bot, chatId, reply, rest }) {
  const windowSize = Number(rest || 20);

  const stats = evaluateDecisionShadowWindow(windowSize);

  const text = buildText(stats);

  if (typeof reply === "function") {
    await reply(text, {
      cmd: "/diag_decision_window",
      handler: "handleDecisionDiagWindow",
    });
    return;
  }

  await bot.sendMessage(chatId, text);
}