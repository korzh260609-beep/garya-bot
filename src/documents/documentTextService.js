// ============================================================================
// src/documents/documentTextService.js
// STAGE 12.x — DOCUMENT TEXT SERVICE (extract-first)
// Purpose:
// - handle document intake in specialized-first mode
// - extract text from text-like files safely
// - support real DOCX extraction via mammoth
// - provide honest unavailable results for PDF/DOC until parser deps are added
// - do NOT do semantic analysis here
// ============================================================================

import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { VISION_MAX_FILE_MB } from "../core/config.js";

function nowIso() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeExtractedText(value) {
  return safeText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extensionFromIntake(intake) {
  const fileName =
    intake?.downloaded?.fileName ||
    intake?.fileName ||
    intake?.downloaded?.localPath ||
    "";

  const ext = path.extname(String(fileName || "")).trim().toLowerCase();
  return ext || "";
}

function isTextMime(mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  if (!mime) return false;
  if (mime.startsWith("text/")) return true;

  return [
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/x-sh",
    "application/x-httpd-php",
    "application/sql",
  ].includes(mime);
}

function isPlainTextLikeExtension(ext) {
  return new Set([
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".css",
    ".env",
    ".ini",
    ".conf",
    ".cfg",
    ".yaml",
    ".yml",
    ".log",
    ".sql",
    ".sh",
  ]).has(ext);
}

function isRtfExtension(ext, mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  return ext === ".rtf" || mime === "application/rtf" || mime === "text/rtf";
}

function isPdf(ext, mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  return ext === ".pdf" || mime === "application/pdf";
}

function isDocx(ext, mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  return (
    ext === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isDoc(ext, mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  return ext === ".doc" || mime === "application/msword";
}

function readUtf8Text(localPath) {
  return fs.readFileSync(localPath, "utf8");
}

function stripBasicRtf(rtf) {
  const src = safeText(rtf);

  return normalizeExtractedText(
    src
      .replace(/\\par[d]?/gi, "\n")
      .replace(/\\line/gi, "\n")
      .replace(/\\tab/gi, "\t")
      .replace(/\\'[0-9a-fA-F]{2}/g, " ")
      .replace(/\\u-?\d+\??/g, " ")
      .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
      .replace(/[{}]/g, " ")
      .replace(/\s+\n/g, "\n")
  );
}

async function extractDocxText(localPath) {
  const result = await mammoth.extractRawText({ path: localPath });

  return {
    text: normalizeExtractedText(result?.value || ""),
    warnings: Array.isArray(result?.messages)
      ? result.messages.map((item) => {
          const type = item?.type ? String(item.type) : "warning";
          const message = item?.message ? String(item.message) : "unknown";
          return `mammoth_${type}: ${message}`;
        })
      : [],
  };
}

function buildUnavailableResult({
  requestedKind,
  reason,
  filePath = null,
  mimeType = null,
  fileSize = null,
  extension = "",
  extraMeta = {},
}) {
  return {
    ok: false,
    providerKey: "document_text",
    providerActive: true,
    extractOnly: true,
    requestedKind: String(requestedKind || "unknown").trim().toLowerCase(),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: safeNumber(fileSize, null),
      extension: extension || "",
    },
    text: "",
    blocks: [],
    warnings: [reason || "document_text_unavailable"],
    error: reason || "document_text_unavailable",
    meta: {
      stage: "12-document-text-service",
      providerType: "document_text",
      mode: "unavailable",
      ...extraMeta,
    },
  };
}

function buildSuccessResult({
  requestedKind,
  filePath = null,
  mimeType = null,
  fileSize = null,
  extension = "",
  text = "",
  warnings = [],
  extraMeta = {},
}) {
  return {
    ok: true,
    providerKey: "document_text",
    providerActive: true,
    extractOnly: true,
    requestedKind: String(requestedKind || "unknown").trim().toLowerCase(),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: safeNumber(fileSize, null),
      extension: extension || "",
    },
    text: normalizeExtractedText(text),
    blocks: [],
    warnings: Array.isArray(warnings) ? warnings : [],
    error: null,
    meta: {
      stage: "12-document-text-service",
      providerType: "document_text",
      mode: "local_extract",
      ...extraMeta,
    },
  };
}

function resolveValidatedLocalFile(intake) {
  if (!intake || typeof intake !== "object") {
    return {
      ok: false,
      result: buildUnavailableResult({
        requestedKind: "unknown",
        reason: "document_intake_missing",
      }),
    };
  }

  if (!canRunDocumentTextForIntake(intake)) {
    return {
      ok: false,
      result: buildUnavailableResult({
        requestedKind: intake?.kind || "unknown",
        reason: "document_kind_not_supported",
      }),
    };
  }

  const localPath = intake?.downloaded?.localPath || null;
  if (!localPath) {
    return {
      ok: false,
      result: buildUnavailableResult({
        requestedKind: intake?.kind || "unknown",
        reason: "document_local_file_missing",
      }),
    };
  }

  const stat = safeFileStat(localPath);
  if (!stat || !stat.isFile()) {
    return {
      ok: false,
      result: buildUnavailableResult({
        requestedKind: intake?.kind || "unknown",
        reason: "document_local_file_not_found",
        filePath: localPath,
      }),
    };
  }

  const maxBytes = bytesFromMb(VISION_MAX_FILE_MB);
  if (stat.size > maxBytes) {
    return {
      ok: false,
      result: buildUnavailableResult({
        requestedKind: intake?.kind || "unknown",
        reason: "document_file_too_large",
        filePath: localPath,
        mimeType: intake?.mimeType || null,
        fileSize: stat.size,
        extension: extensionFromIntake(intake),
        extraMeta: {
          maxBytes,
        },
      }),
    };
  }

  return {
    ok: true,
    localPath: path.resolve(localPath),
    fileSize: stat.size,
    extension: extensionFromIntake(intake),
  };
}

export function canRunDocumentTextForIntake(intake) {
  const kind = String(intake?.kind || "").trim().toLowerCase();
  return kind === "document";
}

export function getDocumentTextServiceStatus(params = {}) {
  const ext = path.extname(String(params?.fileName || "")).trim().toLowerCase();
  const mimeType = String(params?.mimeType || "").trim().toLowerCase();

  return {
    stage: "12-document-text-service",
    service: "document_text",
    enabled: true,
    extractOnly: true,
    maxFileMb: VISION_MAX_FILE_MB,
    mimeType: mimeType || null,
    extension: ext || "",
    pdfReady: false,
    docxReady: true,
    notes:
      "Text-like files supported. RTF basic extraction supported. DOCX extraction supported via mammoth. PDF/DOC still need parser dependency.",
  };
}

export async function extractTextFromDocumentIntake(intake) {
  const validated = resolveValidatedLocalFile(intake);
  if (!validated.ok) {
    return validated.result;
  }

  const localPath = validated.localPath;
  const fileSize = validated.fileSize;
  const extension = validated.extension;
  const mimeType = intake?.mimeType || null;
  const requestedKind = intake?.kind || "document";

  try {
    if (isPdf(extension, mimeType)) {
      return buildUnavailableResult({
        requestedKind,
        reason: "pdf_parser_not_available_current_stage",
        filePath: localPath,
        mimeType,
        fileSize,
        extension,
      });
    }

    if (isDocx(extension, mimeType)) {
      const docxResult = await extractDocxText(localPath);

      return buildSuccessResult({
        requestedKind,
        filePath: localPath,
        mimeType,
        fileSize,
        extension,
        text: docxResult.text,
        warnings: docxResult.warnings,
        extraMeta: {
          parser: "mammoth_raw_text",
        },
      });
    }

    if (isDoc(extension, mimeType)) {
      return buildUnavailableResult({
        requestedKind,
        reason: "doc_parser_not_available_current_stage",
        filePath: localPath,
        mimeType,
        fileSize,
        extension,
      });
    }

    if (isRtfExtension(extension, mimeType)) {
      const raw = readUtf8Text(localPath);
      const text = stripBasicRtf(raw);

      return buildSuccessResult({
        requestedKind,
        filePath: localPath,
        mimeType,
        fileSize,
        extension,
        text,
        extraMeta: {
          parser: "basic_rtf_strip",
        },
      });
    }

    if (isTextMime(mimeType) || isPlainTextLikeExtension(extension)) {
      const text = readUtf8Text(localPath);

      return buildSuccessResult({
        requestedKind,
        filePath: localPath,
        mimeType,
        fileSize,
        extension,
        text,
        extraMeta: {
          parser: "utf8_plain_text",
        },
      });
    }

    return buildUnavailableResult({
      requestedKind,
      reason: "document_type_not_supported_current_stage",
      filePath: localPath,
      mimeType,
      fileSize,
      extension,
    });
  } catch (error) {
    return buildUnavailableResult({
      requestedKind,
      reason: "document_extract_failed",
      filePath: localPath,
      mimeType,
      fileSize,
      extension,
      extraMeta: {
        message: error?.message ? String(error.message) : "unknown_error",
      },
    });
  }
}

export default {
  canRunDocumentTextForIntake,
  getDocumentTextServiceStatus,
  extractTextFromDocumentIntake,
};