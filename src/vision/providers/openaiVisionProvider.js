// ============================================================================
// src/vision/providers/openaiVisionProvider.js
// STAGE 12.2 — OPENAI vision provider (skeleton)
// Purpose:
// - selectable provider
// - no real API call yet
// - provider metadata + contract only
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
    warnings: [reason || "openai_provider_not_implemented_yet"],
    error: reason || "openai_provider_not_implemented_yet",
    meta: {
      stage: "12.2-skeleton",
      providerType: "openai",
      mode: "skeleton",
    },
  };
}

export function createOpenAIVisionProvider(baseStatus = {}) {
  const providerKey = "openai";

  return {
    key: providerKey,
    status: {
      ...baseStatus,
      key: providerKey,
      displayName: "OpenAI Vision Provider",
      supportsVision: true,
      supportsOcr: true,
      supportsDocs: true,
      providerAvailable: true,
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
        reason: "openai_provider_not_implemented_yet",
        filePath,
        mimeType,
        fileSize,
      });
    },
  };
}

export default {
  createOpenAIVisionProvider,
};