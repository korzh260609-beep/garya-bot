// ============================================================================
// src/vision/visionProvider.js
// STAGE 12.1 — OCR vision provider contract (provider-agnostic skeleton)
// Purpose:
// - one stable contract for future Vision/OCR providers
// - current default provider is NOOP / unavailable
// - no real OCR yet
// ============================================================================

import {
  VISION_ENABLED,
  VISION_PROVIDER,
  VISION_OCR_ENABLED,
  VISION_EXTRACT_ONLY,
  VISION_MAX_FILE_MB,
  VISION_TIMEOUT_MS,
} from "../core/config.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeFileKind(kind) {
  return String(kind || "").trim().toLowerCase() || "unknown";
}

function buildUnavailableExtractResult({
  providerKey,
  requestedKind,
  reason,
  filePath = null,
  mimeType = null,
  fileSize = null,
}) {
  return {
    ok: false,
    providerKey,
    providerActive: false,
    extractOnly: VISION_EXTRACT_ONLY === true,
    requestedKind: normalizeFileKind(requestedKind),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
    },
    text: "",
    blocks: [],
    warnings: [reason || "vision_provider_unavailable"],
    error: reason || "vision_provider_unavailable",
    meta: {
      stage: "12.1-skeleton",
      mode: "unavailable",
    },
  };
}

export function buildVisionProviderConfig() {
  return {
    enabled: VISION_ENABLED === true,
    provider: VISION_PROVIDER || "noop",
    ocrEnabled: VISION_OCR_ENABLED === true,
    extractOnly: VISION_EXTRACT_ONLY === true,
    maxFileMb: VISION_MAX_FILE_MB,
    timeoutMs: VISION_TIMEOUT_MS,
  };
}

export function getVisionProviderStatus() {
  const cfg = buildVisionProviderConfig();

  const providerAvailable =
    cfg.enabled === true &&
    cfg.ocrEnabled === true &&
    typeof cfg.provider === "string" &&
    cfg.provider.length > 0 &&
    cfg.provider !== "none" &&
    cfg.provider !== "noop";

  return {
    stage: "12.1-skeleton",
    enabled: cfg.enabled,
    provider: cfg.provider,
    ocrEnabled: cfg.ocrEnabled,
    extractOnly: cfg.extractOnly,
    maxFileMb: cfg.maxFileMb,
    timeoutMs: cfg.timeoutMs,
    providerAvailable,
    notes:
      providerAvailable
        ? "Vision provider looks configured, but concrete provider implementation may still be missing."
        : "Vision provider is not active; runtime must use unavailable/text-fallback behavior.",
  };
}

export function createVisionProvider() {
  const status = getVisionProviderStatus();

  return {
    key: status.provider || "noop",
    status,

    async extractTextFromFile({
      filePath,
      mimeType = null,
      fileSize = null,
      kind = "unknown",
    }) {
      return buildUnavailableExtractResult({
        providerKey: status.provider || "noop",
        requestedKind: kind,
        reason: status.providerAvailable
          ? "vision_provider_not_implemented_yet"
          : "vision_provider_not_active",
        filePath,
        mimeType,
        fileSize,
      });
    },
  };
}

export default {
  buildVisionProviderConfig,
  getVisionProviderStatus,
  createVisionProvider,
};