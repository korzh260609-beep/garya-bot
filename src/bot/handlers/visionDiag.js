// src/bot/handlers/visionDiag.js
// ============================================================================
// STAGE 12.2 — VISION DIAGNOSTIC (monarch/dev)
// Command:
// - /vision_diag
//
// Purpose:
// - show current vision/ocr skeleton status
// - show requested vs selected provider
// - show provider scoring in auto mode
// - no OCR calls
// - no provider execution
// ============================================================================

import { getVisionServiceStatus } from "../../vision/visionService.js";
import {
  getVisionProviderStatus,
  listVisionProviders,
} from "../../vision/visionProvider.js";

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

function formatScoredProviders(scoredProviders) {
  if (!Array.isArray(scoredProviders) || !scoredProviders.length) {
    return ["- (none)"];
  }

  return scoredProviders.map((item) => {
    return [
      `- ${item.key}`,
      `  eligible: ${toBoolText(item.eligible === true)}`,
      `  quality: ${item.qualityScore ?? "n/a"}`,
      `  cost: ${item.costLevel ?? "n/a"}`,
      `  speed: ${item.speedLevel ?? "n/a"}`,
      `  reason: ${item.reason || "n/a"}`,
    ].join("\n");
  });
}

function formatKnownProviders(providers) {
  if (!Array.isArray(providers) || !providers.length) {
    return ["- (none)"];
  }

  return providers.map((item) => {
    const status = item?.status || {};
    return [
      `- ${item?.key || "unknown"}`,
      `  flag_enabled: ${toBoolText(status?.providerFlagEnabled === true)}`,
      `  supportsVision: ${toBoolText(status?.supportsVision === true)}`,
      `  supportsOcr: ${toBoolText(status?.supportsOcr === true)}`,
      `  supportsDocs: ${toBoolText(status?.supportsDocs === true)}`,
      `  costLevel: ${status?.costLevel ?? "n/a"}`,
      `  speedLevel: ${status?.speedLevel ?? "n/a"}`,
    ].join("\n");
  });
}

function buildVisionDiagText() {
  const service = getVisionServiceStatus({ kind: "photo" });
  const provider = getVisionProviderStatus({ kind: "photo" });
  const providers = listVisionProviders();

  const lines = [];

  lines.push("VISION DIAG");
  lines.push(`stage: ${service?.stage || "12.2-skeleton"}`);
  lines.push(`service: ${service?.service || "vision"}`);
  lines.push(`enabled: ${toBoolText(service?.enabled === true)}`);
  lines.push(`ocr_enabled: ${toBoolText(service?.ocrEnabled === true)}`);
  lines.push(`extract_only: ${toBoolText(service?.extractOnly === true)}`);
  lines.push(`requested_provider: ${service?.requestedProvider || "n/a"}`);
  lines.push(`selected_provider: ${service?.selectedProviderKey || "n/a"}`);
  lines.push(`provider_available: ${toBoolText(service?.providerAvailable === true)}`);
  lines.push(`selection_mode: ${service?.selectionMode || "n/a"}`);
  lines.push(`min_quality_score: ${service?.minQualityScore ?? "n/a"}`);
  lines.push(`task_type_sample: ${service?.taskType || "n/a"}`);
  lines.push(`max_file_mb: ${service?.maxFileMb ?? "n/a"}`);
  lines.push("");

  lines.push("Router status:");
  lines.push(`- provider: ${provider?.provider || "n/a"}`);
  lines.push(`- requestedProvider: ${provider?.requestedProvider || "n/a"}`);
  lines.push(`- selectedProviderKey: ${provider?.selectedProviderKey || "n/a"}`);
  lines.push(`- enabled: ${toBoolText(provider?.enabled === true)}`);
  lines.push(`- ocrEnabled: ${toBoolText(provider?.ocrEnabled === true)}`);
  lines.push(`- extractOnly: ${toBoolText(provider?.extractOnly === true)}`);
  lines.push(`- timeoutMs: ${provider?.timeoutMs ?? "n/a"}`);
  lines.push(`- reason: ${provider?.reason || "n/a"}`);
  lines.push(`- notes: ${provider?.notes || "n/a"}`);
  lines.push("");

  lines.push("Known providers:");
  lines.push(...formatKnownProviders(providers));
  lines.push("");

  lines.push("Scored providers:");
  lines.push(...formatScoredProviders(service?.scoredProviders || []));
  lines.push("");

  lines.push("Policy:");
  lines.push("- current auto mode picks cheapest acceptable provider");
  lines.push("- quality must be >= threshold");
  lines.push("- no real OCR call guaranteed yet");
  lines.push("- provider files are switchable by config/env");

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