// ============================================================================
// src/vision/visionService.js
// STAGE 12.1 — OCR vision service (provider-agnostic skeleton)
// Rules:
// - extract-only contract
// - no semantic analysis
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
    stage: "12.1-skeleton",
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

export function getVisionServiceStatus() {
  const providerStatus = getVisionProviderStatus();

  return {
    stage: "12.1-skeleton",
    service: "vision",
    provider: providerStatus.provider,
    enabled: providerStatus.enabled,
    providerAvailable: providerStatus.providerAvailable,
    ocrEnabled: providerStatus.ocrEnabled,
    extractOnly: providerStatus.extractOnly,
    maxFileMb: providerStatus.maxFileMb,
  };
}

export function canRunVisionForIntake(intake) {
  const kind = String(intake?.kind || "").trim().toLowerCase();
  if (!kind) return false;

  if (kind === "photo") return true;

  // future note:
  // document may later be routed to parser/image-ocr split.
  // For 12.1 we keep only image/photo-safe path active.
  return false;
}

export async function extractTextWithVisionFromIntake(intake) {
  if (!intake || typeof intake !== "object") {
    return buildInvalidResult("vision_intake_missing");
  }

  if (!canRunVisionForIntake(intake)) {
    return buildInvalidResult("vision_kind_not_supported_in_12_1", {
      kind: intake?.kind || "unknown",
    });
  }

  const localPath = intake?.downloaded?.localPath || null;
  if (!localPath) {
    return buildInvalidResult("vision_local_file_missing", {
      kind: intake?.kind || "unknown",
    });
  }

  const stat = safeFileStat(localPath);
  if (!stat || !stat.isFile()) {
    return buildInvalidResult("vision_local_file_not_found", {
      localPath,
    });
  }

  const maxBytes = bytesFromMb(VISION_MAX_FILE_MB);
  if (stat.size > maxBytes) {
    return buildInvalidResult("vision_file_too_large", {
      localPath,
      fileSize: stat.size,
      maxBytes,
    });
  }

  const provider = createVisionProvider();

  return provider.extractTextFromFile({
    filePath: path.resolve(localPath),
    mimeType: intake?.mimeType || null,
    fileSize: stat.size,
    kind: intake?.kind || "unknown",
  });
}

export default {
  getVisionServiceStatus,
  canRunVisionForIntake,
  extractTextWithVisionFromIntake,
};