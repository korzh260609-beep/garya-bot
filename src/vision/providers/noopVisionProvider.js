// ============================================================================
// src/vision/providers/noopVisionProvider.js
// STAGE 12.2 — NOOP vision provider
// Purpose:
// - stable fallback provider
// - zero external cost
// - no OCR execution
// ============================================================================

import { VISION_EXTRACT_ONLY } from "../../core/config.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeKind(kind) {
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
    requestedKind: normalizeKind(requestedKind),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
    },
    text: "",
    blocks: [],
    warnings: [reason || "vision_provider_noop"],
    error: reason || "vision_provider_noop",
    meta: {
      stage: "12.2-skeleton",
      providerType: "noop",
      mode: "unavailable",
    },
  };
}

export function createNoopVisionProvider(baseStatus = {}) {
  const providerKey = "noop";

  return {
    key: providerKey,
    status: {
      ...baseStatus,
      key: providerKey,
      displayName: "NOOP Vision Provider",
      providerAvailable: false,
      enabled: true,
      supportsVision: true,
      supportsOcr: false,
      supportsDocs: false,
      costLevel: 0,
      speedLevel: 100,
    },

    async extractTextFromFile({
      filePath,
      mimeType = null,
      fileSize = null,
      kind = "unknown",
    }) {
      return buildUnavailableExtractResult({
        providerKey,
        requestedKind: kind,
        reason: "vision_provider_noop",
        filePath,
        mimeType,
        fileSize,
      });
    },
  };
}

export default {
  createNoopVisionProvider,
};