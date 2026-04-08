// src/bot/handlers/visionDiag.js
// ============================================================================
// STAGE 12.3 — VISION DIAGNOSTIC (monarch/dev)
// Command:
// - /vision_diag
//
// Purpose:
// - show current vision/ocr status
// - show requested vs selected provider
// - show provider scoring in auto mode
// - show which providers are actually ready now
// ============================================================================

import { getVisionServiceStatus } from "../../vision/visionService.js";
import {
  getVisionProviderStatus,
  listVisionProviders,
} from "../../vision/visionProvider.js";
import { requireMonarchAccess } from "./handlerAccess.js";

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
      `  provider_ready: ${toBoolText(status?.providerAvailable === true)}`,
      `  supportsVision: ${toBoolText(status?.supportsVision === true)}`,
      `  supportsOcr: ${toBoolText(status?.supportsOcr === true)}`,
      `  supportsDocs: ${toBoolText(status?.supportsDocs === true)}`,
      `  costLevel: ${status?.costLevel ?? "n/a"}`,
      `  speedLevel: ${status?.speedLevel ?? "n/a"}`,
      `  notes: ${status?.notes || "n/a"}`,
    ].join("\n");
  });
}

function buildVisionDiagText() {
  const service = getVisionServiceStatus({ kind: "photo" });
  const provider = getVisionProviderStatus({ kind: "photo" });
  const providers = listVisionProviders();

  const lines = [];

  lines.push("VISION DIAG");
  lines.push(`stage: ${service?.stage || "12.3-openai-first"}`);
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
  lines.push("- provider must be both enabled and really ready");
  lines.push("- only OpenAI is implemented first in this step");
  lines.push("- provider files remain switchable by config/env");

  return lines.join("\n");
}

export async function handleVisionDiag(ctx = {}) {
  const ok = await requireMonarchAccess(ctx);
  if (!ok) return;

  await ctx.bot.sendMessage(ctx.chatId, buildVisionDiagText());
}

export default {
  handleVisionDiag,
};