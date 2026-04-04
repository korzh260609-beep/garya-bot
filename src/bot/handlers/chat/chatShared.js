// src/bot/handlers/chat/chatShared.js

export function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeFileBaseName(value) {
  const src = safeText(value) || "document";
  return (
    src
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s+/g, "_")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+/, "")
      .replace(/_+$/, "") || "document"
  );
}

export function normalizeRequestedOutputFormat(value) {
  const src = safeText(value).toLowerCase();

  if (src === "txt") return "txt";
  if (src === "md") return "md";
  if (src === "pdf") return "pdf";
  if (src === "docx") return "docx";
  if (src === "auto") return "txt";

  return "txt";
}

export function normalizePreferredExportKind(value) {
  const src = safeText(value).toLowerCase();

  if (src === "document") return "document";
  if (src === "assistant_reply") return "assistant_reply";
  return "";
}

export function normalizeDocumentExportTarget(value) {
  const src = safeText(value).toLowerCase();

  if (src === "summary") return "summary";
  if (src === "full_text") return "full_text";
  if (src === "current_part") return "current_part";
  if (src === "assistant_answer_about_document") {
    return "assistant_answer_about_document";
  }

  return "";
}

export function isDocumentRelatedSourceKind(value) {
  const src = safeText(value).toLowerCase();
  return src === "document";
}

export default {
  safeText,
  normalizeFileBaseName,
  normalizeRequestedOutputFormat,
  normalizePreferredExportKind,
  normalizeDocumentExportTarget,
  isDocumentRelatedSourceKind,
};