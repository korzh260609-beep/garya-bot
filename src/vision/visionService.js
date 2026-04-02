// ============================================================================
// src/vision/visionService.js
// STAGE 12.4 — OCR + visible-facts vision service with provider router
// Rules:
// - OCR path remains extract-only
// - visible-facts path is short and evidence-based
// - no direct chat formatting here
// - current runtime may return unavailable/noop result
// ============================================================================

import fs from "fs";
import path from "path";
import {
  VISION_MAX_FILE_MB,
  VISION_EXTRACT_ONLY,
} from "../core/config.js";
import {
  createVisionProvider,
  getVisionProviderStatus,
} from "./visionProvider.js";

function nowIso() {
  return new Date().toISOString();
}

function bytesFromMb(mb) {
  return Math.max(1, Number(mb) || 0) * 1024 * 1024;
}

function safeFileStat(filePath) {
  try {
    if (!filePath) return null;
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function buildInvalidResult(reason, extra = {}) {
  return {
    ok: false,
    stage: "12.4-ocr-plus-facts",
    extractOnly: VISION_EXTRACT_ONLY === true,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    text: "",
    blocks: [],
    warnings: [reason],
    error: reason,
    meta: {
      reason,
      ...extra,
    },
  };
}

function resolveValidatedLocalFile(intake) {
  if (!intake || typeof intake !== "object") {
    return {
      ok: false,
      result: buildInvalidResult("vision_intake_missing"),
    };
  }

  if (!canRunVisionForIntake(intake)) {
    return {
      ok: false,
      result: buildInvalidResult("vision_kind_not_supported_in_current_stage", {
        kind: intake?.kind || "unknown",
      }),
    };
  }

  const localPath = intake?.downloaded?.localPath || null;
  if (!localPath) {
    return {
      ok: false,
      result: buildInvalidResult("vision_local_file_missing", {
        kind: intake?.kind || "unknown",
      }),
    };
  }

  const stat = safeFileStat(localPath);
  if (!stat || !stat.isFile()) {
    return {
      ok: false,
      result: buildInvalidResult("vision_local_file_not_found", {
        localPath,
      }),
    };
  }

  const maxBytes = bytesFromMb(VISION_MAX_FILE_MB);
  if (stat.size > maxBytes) {
    return {
      ok: false,
      result: buildInvalidResult("vision_file_too_large", {
        localPath,
        fileSize: stat.size,
        maxBytes,
      }),
    };
  }

  return {
    ok: true,
    localPath: path.resolve(localPath),
    fileSize: stat.size,
  };
}

export function getVisionServiceStatus(params = {}) {
  const providerStatus = getVisionProviderStatus(params);

  return {
    stage: "12.4-ocr-plus-facts",
    service: "vision",
    provider: providerStatus.provider,
    requestedProvider: providerStatus.requestedProvider,
    selectedProviderKey: providerStatus.selectedProviderKey,
    enabled: providerStatus.enabled,
    providerAvailable: providerStatus.providerAvailable,
    ocrEnabled: providerStatus.ocrEnabled,
    extractOnly: providerStatus.extractOnly,
    maxFileMb: providerStatus.maxFileMb,
    selectionMode: providerStatus.selectionMode,
    minQualityScore: providerStatus.minQualityScore,
    taskType: providerStatus.taskType,
    scoredProviders: providerStatus.scoredProviders || [],
    reason: providerStatus.reason || "unknown",
  };
}

export function canRunVisionForIntake(intake) {
  const kind = String(intake?.kind || "").trim().toLowerCase();
  if (!kind) return false;

  if (kind === "photo") return true;

  // future note:
  // document may later be routed to parser/image-ocr split.
  // For current stage we keep only image/photo-safe path active.
  return false;
}

export async function extractTextWithVisionFromIntake(intake) {
  const validated = resolveValidatedLocalFile(intake);
  if (!validated.ok) {
    return validated.result;
  }

  const provider = createVisionProvider({
    kind: intake?.kind || "unknown",
    mimeType: intake?.mimeType || null,
  });

  if (typeof provider?.extractTextFromFile !== "function") {
    return buildInvalidResult("vision_provider_extract_text_not_supported", {
      providerKey: provider?.key || "unknown",
    });
  }

  return provider.extractTextFromFile({
    filePath: validated.localPath,
    mimeType: intake?.mimeType || null,
    fileSize: validated.fileSize,
    kind: intake?.kind || "unknown",
  });
}

export async function extractVisibleFactsWithVisionFromIntake(intake) {
  const validated = resolveValidatedLocalFile(intake);
  if (!validated.ok) {
    return validated.result;
  }

  const provider = createVisionProvider({
    kind: intake?.kind || "unknown",
    mimeType: intake?.mimeType || null,
  });

  if (typeof provider?.extractVisibleFactsFromFile !== "function") {
    return buildInvalidResult("vision_provider_extract_facts_not_supported", {
      providerKey: provider?.key || "unknown",
    });
  }

  return provider.extractVisibleFactsFromFile({
    filePath: validated.localPath,
    mimeType: intake?.mimeType || null,
    fileSize: validated.fileSize,
    kind: intake?.kind || "unknown",
  });
}

export default {
  getVisionServiceStatus,
  canRunVisionForIntake,
  extractTextWithVisionFromIntake,
  extractVisibleFactsWithVisionFromIntake,
};