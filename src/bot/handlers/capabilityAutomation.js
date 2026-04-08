// src/bot/handlers/capabilityAutomation.js
// ============================================================================
// STAGE 12A.4 — AUTOMATION / WEBHOOK CAPABILITY (SKELETON)
// Command:
// - /cap_automation [request]
// Purpose:
// - no real webhook creation
// - no side-effects
// - safe contract + request capture only
// ============================================================================

import { getCapabilityByKey } from "../../capabilities/capabilityRegistry.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function normalizeRest(rest) {
  return String(rest || "").trim();
}

function formatAutomationCapabilityText(capability, requestText) {
  const lines = [];

  lines.push("AUTOMATION / WEBHOOK CAPABILITY");
  lines.push(`stage: ${capability?.stage || "12A.4"}`);
  lines.push(`status: ${capability?.status || "skeleton"}`);
  lines.push(`command: ${capability?.command || "/cap_automation"}`);
  lines.push(`readOnly: ${String(capability?.readOnly === true)}`);
  lines.push(`autoExecute: ${String(capability?.autoExecute === true)}`);
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
  lines.push("- use this command to fix trigger/delivery contract");
  lines.push("- later connect real automation modules without changing command meaning");

  return lines.join("\n");
}

export async function handleCapabilityAutomation(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const capability = getCapabilityByKey("automation_webhook");
  const requestText = normalizeRest(ctx.rest);

  await ctx.bot.sendMessage(
    ctx.chatId,
    formatAutomationCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityAutomation,
};