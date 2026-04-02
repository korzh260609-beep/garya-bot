// ============================================================================
// src/vision/providers/geminiVisionProvider.js
// STAGE 12.3 — GEMINI vision provider (skeleton only)
// Purpose:
// - selectable provider
// - no real API call yet
// - MUST remain unavailable until implemented
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
    warnings: [reason || "gemini_provider_not_implemented_yet"],
    error: reason || "gemini_provider_not_implemented_yet",
    meta: {
      stage: "12.3-openai-first",
      providerType: "gemini",
      mode: "skeleton",
    },
  };
}

export function createGeminiVisionProvider(baseStatus = {}) {
  const providerKey = "gemini";

  return {
    key: providerKey,
    status: {
      ...baseStatus,
      key: providerKey,
      displayName: "Gemini Vision Provider",
      supportsVision: true,
      supportsOcr: true,
      supportsDocs: true,
      providerAvailable: false,
      notes: "Skeleton only. Gemini real API call is not implemented yet.",
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
        reason: "gemini_provider_not_implemented_yet",
        filePath,
        mimeType,
        fileSize,
      });
    },
  };
}

export default {
  createGeminiVisionProvider,
};