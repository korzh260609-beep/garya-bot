// src/bot/handlers/capabilityDiagram.js
// ============================================================================
// STAGE 12A.1 — DIAGRAM / CHART CAPABILITY (SKELETON)
// Command:
// - /cap_diagram [request]
// Purpose:
// - no generation yet
// - no files yet
// - safe contract + request capture only
// ============================================================================

import { getCapabilityByKey } from "../../capabilities/capabilityRegistry.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function normalizeRest(rest) {
  return String(rest || "").trim();
}

function formatDiagramCapabilityText(capability, requestText) {
  const lines = [];

  lines.push("DIAGRAM / CHART CAPABILITY");
  lines.push(`stage: ${capability?.stage || "12A.1"}`);
  lines.push(`status: ${capability?.status || "skeleton"}`);
  lines.push(`command: ${capability?.command || "/cap_diagram"}`);
  lines.push(`readOnly: ${String(capability?.readOnly === true)}`);
  lines.push(`fileOutput: ${String(capability?.fileOutput === true)}`);
  lines.push("");

  lines.push("Current mode:");
  lines.push("- skeleton only");

  if (Array.isArray(capability?.currentLimits) && capability.currentLimits.length) {
    for (const item of capability.currentLimits) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("- no limits declared");
  }

  lines.push("");

  if (requestText) {
    lines.push("Captured request:");
    lines.push(`- ${requestText}`);
    lines.push("");
  }

  lines.push("Safe next use:");
  lines.push("- use this command to fix contract and expected output");
  lines.push("- later connect renderer/provider without changing command meaning");

  return lines.join("\n");
}

export async function handleCapabilityDiagram(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const capability = getCapabilityByKey("diagram_chart");
  const requestText = normalizeRest(ctx.rest);

  await ctx.bot.sendMessage(
    ctx.chatId,
    formatDiagramCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityDiagram,
};