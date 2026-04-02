// ============================================================================
// src/vision/visionProvider.js
// STAGE 12.3 — SWITCHABLE VISION PROVIDER ROUTER + SCORER
// Purpose:
// - provider-agnostic contract
// - manual provider switch via env
// - auto mode chooses cheapest acceptable provider
// - ONLY implemented providers may be eligible
// ============================================================================

import {
  VISION_ENABLED,
  VISION_PROVIDER,
  VISION_OCR_ENABLED,
  VISION_EXTRACT_ONLY,
  VISION_MAX_FILE_MB,
  VISION_TIMEOUT_MS,
  VISION_PROVIDER_SELECTION_MODE,
  VISION_MIN_QUALITY_SCORE,
  VISION_PROVIDER_NOOP_ENABLED,
  VISION_PROVIDER_GEMINI_ENABLED,
  VISION_PROVIDER_CLAUDE_ENABLED,
  VISION_PROVIDER_OPENAI_ENABLED,
} from "../core/config.js";

import { createNoopVisionProvider } from "./providers/noopVisionProvider.js";
import { createGeminiVisionProvider } from "./providers/geminiVisionProvider.js";
import { createClaudeVisionProvider } from "./providers/claudeVisionProvider.js";
import { createOpenAIVisionProvider } from "./providers/openaiVisionProvider.js";

const PROVIDER_KEYS = ["noop", "gemini", "claude", "openai"];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeKind(kind) {
  return normalizeText(kind) || "unknown";
}

export function buildVisionProviderConfig() {
  return {
    enabled: VISION_ENABLED === true,
    provider: normalizeText(VISION_PROVIDER) || "noop",
    ocrEnabled: VISION_OCR_ENABLED === true,
    extractOnly: VISION_EXTRACT_ONLY === true,
    maxFileMb: VISION_MAX_FILE_MB,
    timeoutMs: VISION_TIMEOUT_MS,
    selectionMode:
      normalizeText(VISION_PROVIDER_SELECTION_MODE) || "cheapest_acceptable",
    minQualityScore: Number.isFinite(Number(VISION_MIN_QUALITY_SCORE))
      ? Number(VISION_MIN_QUALITY_SCORE)
      : 60,
    providerFlags: {
      noop: VISION_PROVIDER_NOOP_ENABLED === true,
      gemini: VISION_PROVIDER_GEMINI_ENABLED === true,
      claude: VISION_PROVIDER_CLAUDE_ENABLED === true,
      openai: VISION_PROVIDER_OPENAI_ENABLED === true,
    },
  };
}

function getQualityScoresByTask(providerKey) {
  switch (providerKey) {
    case "gemini":
      return {
        photo_ocr: 82,
        screenshot_ocr: 84,
        document_ocr: 78,
        mixed_layout: 76,
      };

    case "claude":
      return {
        photo_ocr: 79,
        screenshot_ocr: 81,
        document_ocr: 77,
        mixed_layout: 74,
      };

    case "openai":
      return {
        photo_ocr: 77,
        screenshot_ocr: 80,
        document_ocr: 75,
        mixed_layout: 73,
      };

    case "noop":
    default:
      return {
        photo_ocr: 0,
        screenshot_ocr: 0,
        document_ocr: 0,
        mixed_layout: 0,
      };
  }
}

function getCostLevel(providerKey) {
  switch (providerKey) {
    case "gemini":
      return 1;
    case "claude":
      return 3;
    case "openai":
      return 2;
    case "noop":
    default:
      return 999;
  }
}

function getSpeedLevel(providerKey) {
  switch (providerKey) {
    case "gemini":
      return 78;
    case "claude":
      return 72;
    case "openai":
      return 76;
    case "noop":
    default:
      return 100;
  }
}

function detectTaskType({ kind = "unknown", mimeType = null } = {}) {
  const normalizedKind = normalizeKind(kind);
  const mime = normalizeText(mimeType);

  if (normalizedKind === "photo") return "photo_ocr";
  if (normalizedKind === "document") return "document_ocr";
  if (mime.includes("screenshot")) return "screenshot_ocr";

  return "mixed_layout";
}

function buildBaseProviderStatus(providerKey, cfg) {
  const qualityScoresByTask = getQualityScoresByTask(providerKey);

  return {
    stage: "12.3-openai-first",
    key: providerKey,
    enabled: cfg.enabled === true,
    ocrEnabled: cfg.ocrEnabled === true,
    extractOnly: cfg.extractOnly === true,
    maxFileMb: cfg.maxFileMb,
    timeoutMs: cfg.timeoutMs,
    selectionMode: cfg.selectionMode,
    minQualityScore: cfg.minQualityScore,
    supportsVision: providerKey !== "noop",
    supportsOcr: providerKey !== "noop",
    supportsDocs: providerKey !== "noop",
    qualityScoresByTask,
    costLevel: getCostLevel(providerKey),
    speedLevel: getSpeedLevel(providerKey),
    providerFlagEnabled: cfg.providerFlags?.[providerKey] === true,
    providerAvailable: false,
    notes: "provider status base",
  };
}

function instantiateProviderByKey(providerKey, cfg) {
  const baseStatus = buildBaseProviderStatus(providerKey, cfg);

  switch (providerKey) {
    case "gemini":
      return createGeminiVisionProvider(baseStatus);
    case "claude":
      return createClaudeVisionProvider(baseStatus);
    case "openai":
      return createOpenAIVisionProvider(baseStatus);
    case "noop":
    default:
      return createNoopVisionProvider(baseStatus);
  }
}

function getAllProvidersInternal() {
  const cfg = buildVisionProviderConfig();
  return PROVIDER_KEYS.map((key) => instantiateProviderByKey(key, cfg));
}

export function listVisionProviders() {
  return getAllProvidersInternal().map((provider) => ({
    key: provider?.key || "unknown",
    status: { ...(provider?.status || {}) },
  }));
}

export function scoreVisionProvider(provider, taskType, cfg) {
  const key = provider?.key || "unknown";
  const status = provider?.status || {};
  const qualityScoresByTask = status.qualityScoresByTask || {};
  const qualityScore = Number(qualityScoresByTask?.[taskType] || 0);
  const costLevel = Number(status?.costLevel || 999);
  const enabledByFlags =
    cfg.enabled === true &&
    cfg.ocrEnabled === true &&
    status.providerFlagEnabled === true;

  const actuallyUsable = status.providerAvailable === true;

  const eligible =
    enabledByFlags === true &&
    actuallyUsable === true &&
    key !== "noop" &&
    qualityScore >= cfg.minQualityScore;

  return {
    key,
    eligible,
    qualityScore,
    costLevel,
    speedLevel: Number(status?.speedLevel || 0),
    reason:
      eligible
        ? "eligible"
        : enabledByFlags !== true
          ? "provider_disabled"
          : actuallyUsable !== true
            ? "provider_not_implemented_or_not_ready"
            : qualityScore < cfg.minQualityScore
              ? "quality_below_threshold"
              : "unknown",
  };
}

export function chooseVisionProvider({
  kind = "unknown",
  mimeType = null,
} = {}) {
  const cfg = buildVisionProviderConfig();
  const requestedProvider = cfg.provider || "noop";
  const taskType = detectTaskType({ kind, mimeType });

  const allProviders = getAllProvidersInternal();
  const scored = allProviders.map((provider) =>
    scoreVisionProvider(provider, taskType, cfg)
  );

  if (cfg.enabled !== true || cfg.ocrEnabled !== true) {
    const noopProvider = allProviders.find((item) => item.key === "noop");
    return {
      mode: "disabled",
      taskType,
      requestedProvider,
      selectedProviderKey: "noop",
      selectedProvider: noopProvider || createNoopVisionProvider({}),
      scoredProviders: scored,
      reason: "vision_disabled_or_ocr_disabled",
    };
  }

  if (requestedProvider !== "auto" || cfg.selectionMode === "manual") {
    const exact =
      allProviders.find((item) => item.key === requestedProvider) ||
      allProviders.find((item) => item.key === "noop");

    return {
      mode: "manual",
      taskType,
      requestedProvider,
      selectedProviderKey: exact?.key || "noop",
      selectedProvider: exact || createNoopVisionProvider({}),
      scoredProviders: scored,
      reason:
        exact?.key === requestedProvider
          ? "manual_provider_selected"
          : "manual_provider_not_found_fallback_noop",
    };
  }

  const eligible = scored
    .filter((item) => item.eligible === true)
    .sort((a, b) => {
      if (a.costLevel !== b.costLevel) return a.costLevel - b.costLevel;
      if (a.qualityScore !== b.qualityScore) return b.qualityScore - a.qualityScore;
      return (b.speedLevel || 0) - (a.speedLevel || 0);
    });

  if (!eligible.length) {
    const noopProvider = allProviders.find((item) => item.key === "noop");
    return {
      mode: "auto",
      taskType,
      requestedProvider,
      selectedProviderKey: "noop",
      selectedProvider: noopProvider || createNoopVisionProvider({}),
      scoredProviders: scored,
      reason: "no_acceptable_provider_fallback_noop",
    };
  }

  const selectedScore = eligible[0];
  const selectedProvider =
    allProviders.find((item) => item.key === selectedScore.key) ||
    allProviders.find((item) => item.key === "noop");

  return {
    mode: "auto",
    taskType,
    requestedProvider,
    selectedProviderKey: selectedProvider?.key || "noop",
    selectedProvider: selectedProvider || createNoopVisionProvider({}),
    scoredProviders: scored,
    reason: "cheapest_acceptable_provider_selected",
  };
}

export function getVisionProviderStatus(params = {}) {
  const cfg = buildVisionProviderConfig();
  const choice = chooseVisionProvider(params);

  return {
    stage: "12.3-openai-first",
    enabled: cfg.enabled,
    provider: cfg.provider,
    ocrEnabled: cfg.ocrEnabled,
    extractOnly: cfg.extractOnly,
    maxFileMb: cfg.maxFileMb,
    timeoutMs: cfg.timeoutMs,
    selectionMode: cfg.selectionMode,
    minQualityScore: cfg.minQualityScore,
    providerAvailable:
      choice?.selectedProvider?.status?.providerAvailable === true,
    requestedProvider: choice?.requestedProvider || cfg.provider,
    selectedProviderKey: choice?.selectedProviderKey || "noop",
    taskType: choice?.taskType || detectTaskType(params),
    scoredProviders: choice?.scoredProviders || [],
    reason: choice?.reason || "unknown",
    notes:
      "Switchable provider router. Auto mode chooses the cheapest provider that passes the minimum quality threshold and is actually implemented/ready.",
  };
}

export function createVisionProvider(params = {}) {
  const choice = chooseVisionProvider(params);
  return choice?.selectedProvider || createNoopVisionProvider({});
}

export default {
  buildVisionProviderConfig,
  listVisionProviders,
  scoreVisionProvider,
  chooseVisionProvider,
  getVisionProviderStatus,
  createVisionProvider,
};