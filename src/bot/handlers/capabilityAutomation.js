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
  lines.push("- no webhook creation");
  lines.push("- no endpoint registration");
  lines.push("- no env/secrets mutation");
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

export async function handleCapabilityAutomation({
  bot,
  chatId,
  senderIdStr,
  rest,
}) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const capability = getCapabilityByKey("automation_webhook");
  const requestText = normalizeRest(rest);

  await bot.sendMessage(
    chatId,
    formatAutomationCapabilityText(capability, requestText)
  );
}

export default {
  handleCapabilityAutomation,
};