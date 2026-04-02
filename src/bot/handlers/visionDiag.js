// src/bot/handlers/visionDiag.js
// ============================================================================
// STAGE 12.1 — VISION DIAGNOSTIC (monarch/dev)
// Command:
// - /vision_diag
//
// Purpose:
// - show current vision/ocr skeleton status
// - no OCR calls
// - no provider execution
// - no file handling
// ============================================================================

import { getVisionServiceStatus } from "../../vision/visionService.js";
import { getVisionProviderStatus } from "../../vision/visionProvider.js";

async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

function toBoolText(value) {
  return value === true ? "yes" : "no";
}

function buildVisionDiagText() {
  const service = getVisionServiceStatus();
  const provider = getVisionProviderStatus();

  const lines = [];

  lines.push("VISION DIAG");
  lines.push(`stage: ${service?.stage || "12.1-skeleton"}`);
  lines.push(`service: ${service?.service || "vision"}`);
  lines.push(`enabled: ${toBoolText(service?.enabled === true)}`);
  lines.push(`ocr_enabled: ${toBoolText(service?.ocrEnabled === true)}`);
  lines.push(`extract_only: ${toBoolText(service?.extractOnly === true)}`);
  lines.push(`provider: ${service?.provider || "n/a"}`);
  lines.push(`provider_available: ${toBoolText(service?.providerAvailable === true)}`);
  lines.push(`max_file_mb: ${service?.maxFileMb ?? "n/a"}`);
  lines.push("");

  lines.push("Provider status:");
  lines.push(`- provider: ${provider?.provider || "n/a"}`);
  lines.push(`- enabled: ${toBoolText(provider?.enabled === true)}`);
  lines.push(`- ocrEnabled: ${toBoolText(provider?.ocrEnabled === true)}`);
  lines.push(`- extractOnly: ${toBoolText(provider?.extractOnly === true)}`);
  lines.push(`- maxFileMb: ${provider?.maxFileMb ?? "n/a"}`);
  lines.push(`- timeoutMs: ${provider?.timeoutMs ?? "n/a"}`);
  lines.push(`- providerAvailable: ${toBoolText(provider?.providerAvailable === true)}`);
  lines.push(`- notes: ${provider?.notes || "n/a"}`);

  lines.push("");
  lines.push("Policy:");
  lines.push("- 12.1 = provider-agnostic skeleton");
  lines.push("- no real OCR guaranteed yet");
  lines.push("- no semantic analysis here");
  lines.push("- extract-only contract first");

  return lines.join("\n");
}

export async function handleVisionDiag({ bot, chatId, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  await bot.sendMessage(chatId, buildVisionDiagText());
}

export default {
  handleVisionDiag,
};