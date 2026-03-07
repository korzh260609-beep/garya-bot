// src/bot/handlers/decisionDiagLast.js
// Read-only diagnostic handler for latest Decision telemetry entry

import { getRecentDecisionTelemetry } from "../../decision/index.js";

function safeText(value) {
  if (value == null) return "null";
  const text = String(value);
  return text.length > 700 ? `${text.slice(0, 700)}…` : text;
}

function fmtJsonInline(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (_) {
    return "null";
  }
}

function fmtWarnings(value) {
  if (!Array.isArray(value) || value.length === 0) return "0";
  return `${value.length} -> ${value.map((x) => String(x)).join(" | ")}`;
}

function buildText(record = null) {
  if (!record) {
    return [
      "🧠 DECISION LAST",
      "status: empty",
      "reason: telemetry_not_found",
    ].join("\n");
  }

  const baseline = record?.baseline || {};
  const shadow = record?.shadow || {};
  const analysis = record?.analysis || {};
  const compare = record?.compare || {};

  return [
    "🧠 DECISION LAST",
    `savedAt: ${record?.savedAt || "unknown"}`,
    `ok: ${record?.ok === true ? "true ✅" : "false ⛔"}`,
    `mode: ${record?.mode || "unknown"}`,
    "",

    "baseline:",
    `route: ${fmtJsonInline(baseline?.route)}`,
    `final_text: ${safeText(baseline?.finalText)}`,
    `warnings: ${fmtWarnings(baseline?.warnings)}`,
    "",

    "shadow:",
    `route: ${fmtJsonInline(shadow?.route)}`,
    `final_text: ${safeText(shadow?.finalText)}`,
    `warnings: ${fmtWarnings(shadow?.warnings)}`,
    `duration_ms: ${analysis?.performance?.durationMs ?? shadow?.durationMs ?? 0}`,
    "",

    "compare:",
    `same_final_text: ${analysis?.decisionQuality?.sameFinalText ?? compare?.sameFinalText ?? false}`,
    `same_route: ${analysis?.decisionQuality?.sameRoute ?? compare?.sameRoute ?? false}`,
    `improvement: ${analysis?.decisionQuality?.improvement || "unknown"}`,
    `baseline_warning_count: ${analysis?.warnings?.baseline ?? compare?.baselineWarningsCount ?? 0}`,
    `shadow_warning_count: ${analysis?.warnings?.shadow ?? compare?.shadowWarningsCount ?? 0}`,
  ].join("\n");
}

export async function handleDecisionDiagLast({ bot, chatId, reply }) {
  const last = getRecentDecisionTelemetry(1)?.[0] || null;
  const text = buildText(last);

  if (typeof reply === "function") {
    await reply(text, {
      cmd: "/diag_decision_last",
      handler: "handleDecisionDiagLast",
    });
    return;
  }

  await bot.sendMessage(chatId, text);
}