// ============================================================================
// src/documents/documentOutputService.js
// STAGE 12A.2 — DOCUMENT OUTPUT SERVICE (skeleton-first, safe minimal)
// Purpose:
// - create outgoing document files from text
// - start with safe formats only: txt / md
// - keep PDF/DOCX as honest "not yet connected"
// - do NOT send files to Telegram here
// - do NOT do AI generation here
// ============================================================================

import fs from "fs";
import path from "path";

const OUTPUT_TMP_DIR = path.resolve(process.cwd(), "tmp", "generated-documents");

function nowIso() {
  return new Date().toISOString();
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function ensureOutputTmpDir() {
  if (!fs.existsSync(OUTPUT_TMP_DIR)) {
    fs.mkdirSync(OUTPUT_TMP_DIR, { recursive: true });
  }
}

function sanitizeBaseName(value) {
  const raw = safeText(value).trim() || "document";

  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

  return cleaned || "document";
}

function normalizeFormat(format) {
  return safeText(format).trim().toLowerCase();
}

function extensionForFormat(format) {
  const normalized = normalizeFormat(format);

  if (normalized === "txt") return ".txt";
  if (normalized === "md" || normalized === "markdown") return ".md";
  if (normalized === "pdf") return ".pdf";
  if (normalized === "docx") return ".docx";

  return "";
}

function mimeTypeForFormat(format) {
  const normalized = normalizeFormat(format);

  if (normalized === "txt") return "text/plain";
  if (normalized === "md" || normalized === "markdown") return "text/markdown";
  if (normalized === "pdf") return "application/pdf";
  if (normalized === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
}

function buildUnavailableResult({
  format,
  reason,
  baseName = "document",
  extraMeta = {},
}) {
  return {
    ok: false,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    format: normalizeFormat(format),
    baseName: sanitizeBaseName(baseName),
    fileName: null,
    filePath: null,
    mimeType: mimeTypeForFormat(format),
    size: 0,
    error: reason || "document_output_unavailable",
    warnings: [reason || "document_output_unavailable"],
    meta: {
      service: "document_output",
      stage: "12A.2-document-output-service",
      mode: "unavailable",
      ...extraMeta,
    },
  };
}

function buildSuccessResult({
  format,
  baseName,
  fileName,
  filePath,
  mimeType,
  size,
  extraMeta = {},
}) {
  return {
    ok: true,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    format: normalizeFormat(format),
    baseName: sanitizeBaseName(baseName),
    fileName: safeText(fileName),
    filePath: safeText(filePath),
    mimeType: safeText(mimeType),
    size: Number(size || 0) || 0,
    error: null,
    warnings: [],
    meta: {
      service: "document_output",
      stage: "12A.2-document-output-service",
      mode: "local_file_created",
      ...extraMeta,
    },
  };
}

export function getDocumentOutputServiceStatus() {
  return {
    service: "document_output",
    stage: "12A.2-document-output-service",
    enabled: true,
    sendToTelegramReady: false,
    supportedFormats: ["txt", "md"],
    plannedFormats: ["pdf", "docx"],
    notes:
      "Outgoing document generation currently supports safe text formats only (txt/md). PDF/DOCX generators are not connected yet.",
  };
}

export function canGenerateDocumentOutput(format) {
  const normalized = normalizeFormat(format);
  return normalized === "txt" || normalized === "md" || normalized === "markdown";
}

export function createDocumentOutputFile({
  text = "",
  baseName = "document",
  format = "txt",
}) {
  const normalizedFormat = normalizeFormat(format);
  const normalizedText = normalizeText(text);
  const safeBaseName = sanitizeBaseName(baseName);

  if (!normalizedText) {
    return buildUnavailableResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      reason: "document_output_empty_text",
    });
  }

  if (normalizedFormat === "pdf") {
    return buildUnavailableResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      reason: "document_output_pdf_not_connected_current_stage",
    });
  }

  if (normalizedFormat === "docx") {
    return buildUnavailableResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      reason: "document_output_docx_not_connected_current_stage",
    });
  }

  if (!canGenerateDocumentOutput(normalizedFormat)) {
    return buildUnavailableResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      reason: "document_output_format_not_supported",
    });
  }

  ensureOutputTmpDir();

  const extension = extensionForFormat(normalizedFormat);
  const fileName = `${safeBaseName}${extension}`;
  const filePath = path.join(OUTPUT_TMP_DIR, fileName);
  const mimeType = mimeTypeForFormat(normalizedFormat);

  try {
    fs.writeFileSync(filePath, normalizedText, "utf8");
    const stat = fs.statSync(filePath);

    return buildSuccessResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      fileName,
      filePath,
      mimeType,
      size: stat.size,
      extraMeta: {
        parser: "utf8_local_writer",
        extension,
      },
    });
  } catch (error) {
    return buildUnavailableResult({
      format: normalizedFormat,
      baseName: safeBaseName,
      reason: "document_output_write_failed",
      extraMeta: {
        message: error?.message ? String(error.message) : "unknown_error",
      },
    });
  }
}

export function cleanupDocumentOutputFile(filePath) {
  const target = safeText(filePath).trim();
  if (!target) {
    return {
      ok: true,
      removed: false,
      reason: "no_file_path",
    };
  }

  try {
    if (!fs.existsSync(target)) {
      return {
        ok: true,
        removed: false,
        reason: "already_missing",
        filePath: target,
      };
    }

    fs.unlinkSync(target);

    return {
      ok: true,
      removed: true,
      reason: "removed",
      filePath: target,
    };
  } catch (error) {
    return {
      ok: false,
      removed: false,
      reason: "cleanup_failed",
      filePath: target,
      error: error?.message ? String(error.message) : "unknown_error",
    };
  }
}

export default {
  getDocumentOutputServiceStatus,
  canGenerateDocumentOutput,
  createDocumentOutputFile,
  cleanupDocumentOutputFile,
};