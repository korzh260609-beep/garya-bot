// src/bot/handlers/decisionDiagDbStats.js
// Read-only aggregate diagnostics for persistent Decision telemetry from PostgreSQL

import {
  getDecisionTelemetryDbCount,
  getDecisionTelemetryDbStats,
  getDecisionTelemetryDbLast,
} from "../../db/decisionTelemetryReadRepo.js";

export async function handleDecisionDiagDbStats({ bot, chatId, reply }) {
  const count = await getDecisionTelemetryDbCount();
  const stats = await getDecisionTelemetryDbStats();
  const last = await getDecisionTelemetryDbLast();

  const text = [
    "🧠 DECISION DB STATS",
    `db_count: ${count}`,
    `decision_total: ${stats?.total ?? 0}`,
    "",
    "compare:",
    `shadow_better: ${stats?.shadowBetter ?? 0}`,
    `baseline_better: ${stats?.baselineBetter ?? 0}`,
    `equal: ${stats?.equal ?? 0}`,
    `same_final_text: ${stats?.sameFinalText ?? 0}`,
    `same_route: ${stats?.sameRoute ?? 0}`,
    `avg_duration_ms: ${stats?.avgDurationMs ?? 0}`,
    "",
    "last:",
    `saved_at: ${last?.savedAt || "null"}`,
    `ok: ${last?.ok === true ? "true ✅" : "false ⛔"}`,
    `mode: ${last?.mode || "null"}`,
  ].join("\n");

  if (typeof reply === "function") {
    await reply(text, {
      cmd: "/diag_decision_db_stats",
      handler: "handleDecisionDiagDbStats",
    });
    return;
  }

  await bot.sendMessage(chatId, text);
}