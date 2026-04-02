// ============================================================================
// src/documents/documentStructuring.js
// STAGE 12.6 — DOCUMENT STRUCTURING (extract-first, no AI)
// Purpose:
// - build lightweight structured representation from already-extracted text
// - keep parser layer specialized-first and deterministic
// - do NOT do semantic reasoning here
// - provide blocks + stats for future document-aware flows
// ============================================================================

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeInline(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function wordCount(value) {
  const text = normalizeInline(value);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function charCount(value) {
  return safeText(value).length;
}

function looksLikeHeading(line) {
  const text = normalizeInline(line);
  if (!text) return false;

  const words = wordCount(text);
  const chars = text.length;

  if (chars > 120) return false;
  if (words > 12) return false;

  const endsLikeSentence = /[.!?;:]$/.test(text);
  if (endsLikeSentence) return false;

  const allCapsLike =
    text === text.toUpperCase() &&
    /[A-ZА-ЯІЇЄҐ]/.test(text) &&
    chars >= 3;

  const titleCaseLike =
    /^[A-ZА-ЯІЇЄҐ][^\n]*$/.test(text) &&
    words >= 1 &&
    words <= 8;

  const numberedSectionLike =
    /^(\d+(\.\d+)*[\)\.]?\s+)/.test(text);

  return allCapsLike || numberedSectionLike || titleCaseLike;
}

function splitParagraphs(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function detectBlockType(paragraph, index) {
  const text = normalizeInline(paragraph);
  if (!text) return "paragraph";

  if (looksLikeHeading(text)) {
    return index === 0 ? "title" : "heading";
  }

  if (/^[-•*]\s+/.test(text)) return "list_item";
  if (/^\d+[\.\)]\s+/.test(text)) return "list_item";

  return "paragraph";
}

function buildPreview(text, maxLen = 220) {
  const src = normalizeInline(text);
  if (!src) return "";
  if (src.length <= maxLen) return src;
  return `${src.slice(0, maxLen).trim()}…`;
}

function extractDocumentTitle(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return "";

  const first = normalizeInline(paragraphs[0] || "");
  if (!first) return "";

  if (first.length <= 140 && wordCount(first) <= 16) {
    return first;
  }

  return "";
}

export function buildDocumentStructure(params = {}) {
  const text = normalizeText(params?.text || "");
  const fileName = normalizeInline(params?.fileName || "");
  const mimeType = normalizeInline(params?.mimeType || "");

  const paragraphs = splitParagraphs(text);

  const blocks = paragraphs.map((paragraph, index) => {
    const type = detectBlockType(paragraph, index);
    const normalized = normalizeText(paragraph);

    return {
      index,
      type,
      text: normalized,
      preview: buildPreview(normalized, 220),
      charCount: charCount(normalized),
      wordCount: wordCount(normalized),
    };
  });

  const headings = blocks
    .filter((block) => block.type === "title" || block.type === "heading")
    .map((block) => ({
      index: block.index,
      type: block.type,
      text: block.text,
    }));

  const title =
    extractDocumentTitle(paragraphs) ||
    (headings[0]?.text ? normalizeInline(headings[0].text) : "") ||
    fileName ||
    "";

  return {
    version: 1,
    source: "document_structuring_v1",
    fileName: fileName || null,
    mimeType: mimeType || null,
    title: title || null,
    stats: {
      charCount: charCount(text),
      wordCount: wordCount(text),
      paragraphCount: paragraphs.length,
      blockCount: blocks.length,
      headingCount: headings.length,
    },
    headings,
    blocks,
  };
}

export default {
  buildDocumentStructure,
};