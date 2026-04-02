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

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

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
  lines.push("- no real chart render");
  lines.push("- no image export");
  lines.push("- no external renderer");
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

export async function handleCapabilityDiagram({ bot, chatId, senderIdStr, rest }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const capability = getCapabilityByKey("diagram_chart");
  const requestText = normalizeRest(rest);

  await bot.sendMessage(
    chatId,
    formatDiagramCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityDiagram,
};