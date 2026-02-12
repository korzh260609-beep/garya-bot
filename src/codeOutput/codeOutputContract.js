// ============================================================================
// === src/codeOutput/codeOutputContract.js
// === STAGE 12A / 4.3 — Output Contract (format enforcement)
// === Purpose: parse/validate AI outputs for CODE OUTPUT modes (fullfile/insert)
// === NOTE: This module DOES NOT enable generation. It only validates format.
// ============================================================================

const MAX_FULLFILE_CHARS_DEFAULT = 60000;
const MAX_INSERT_CHARS_DEFAULT = 2000;

function safeStr(x) {
  return typeof x === "string" ? x : String(x ?? "");
}

function trimBOM(s) {
  return s.replace(/^\uFEFF/, "");
}

// ==============================
// FULLFILE CONTRACT
// ==============================
// Required format:
// <<<FILE_START>>>
// <FULL FILE CONTENT>
// <<<FILE_END>>>
export function extractFullFile(raw) {
  const s0 = trimBOM(safeStr(raw));
  const m = s0.match(/<<<FILE_START>>>\s*([\s\S]*?)\s*<<<FILE_END>>>/);
  if (!m || !m[1]) return null;
  return m[1].trim();
}

export function validateFullFile({
  raw,
  maxChars = MAX_FULLFILE_CHARS_DEFAULT,
  forbidMarkersInside = true,
} = {}) {
  const fileText = extractFullFile(raw);
  if (!fileText) {
    return { ok: false, code: "CONTRACT_MISSING_MARKERS", fileText: null };
  }

  if (fileText.length > maxChars) {
    return { ok: false, code: "CONTRACT_TOO_LARGE", fileText };
  }

  if (forbidMarkersInside) {
    if (fileText.includes("<<<FILE_START>>>") || fileText.includes("<<<FILE_END>>>")) {
      return { ok: false, code: "CONTRACT_NESTED_MARKERS", fileText };
    }
  }

  return { ok: true, code: "OK", fileText };
}

// ==============================
// INSERT CONTRACT
// ==============================
// Required format:
// <<<INSERT_START>>>
// path: <path>
// anchor: <anchor>
// mode: before|after|replace
// content:
// <CONTENT>
// <<<INSERT_END>>>
export function extractInsertBlock(raw) {
  const s0 = trimBOM(safeStr(raw));
  const m = s0.match(/<<<INSERT_START>>>\s*([\s\S]*?)\s*<<<INSERT_END>>>/);
  if (!m || !m[1]) return null;

  const body = m[1].trim();

  const pathMatch = body.match(/(?:^|\n)path:\s*(.+)\s*(?:\n|$)/i);
  const anchorMatch = body.match(/(?:^|\n)anchor:\s*(.+)\s*(?:\n|$)/i);
  const modeMatch = body.match(/(?:^|\n)mode:\s*(before|after|replace)\s*(?:\n|$)/i);
  const contentMatch = body.match(/(?:^|\n)content:\s*\n([\s\S]*)$/i);

  const path = pathMatch ? safeStr(pathMatch[1]).trim() : "";
  const anchor = anchorMatch ? safeStr(anchorMatch[1]).trim() : "";
  const mode = modeMatch ? safeStr(modeMatch[1]).trim().toLowerCase() : "";
  const content = contentMatch ? safeStr(contentMatch[1]).replace(/\s+$/, "") : "";

  if (!path || !anchor || !mode || !content) return null;
  if (!["before", "after", "replace"].includes(mode)) return null;

  return { path, anchor, mode, content };
}

export function validateInsert({
  raw,
  expectedPath,
  expectedAnchor,
  maxChars = MAX_INSERT_CHARS_DEFAULT,
  forbidMarkersInside = true,
} = {}) {
  const block = extractInsertBlock(raw);
  if (!block) {
    return { ok: false, code: "CONTRACT_MISSING_MARKERS", block: null };
  }

  if (expectedPath && safeStr(block.path).trim() !== safeStr(expectedPath).trim()) {
    return { ok: false, code: "CONTRACT_PATH_MISMATCH", block };
  }

  if (expectedAnchor && safeStr(block.anchor).trim() !== safeStr(expectedAnchor).trim()) {
    return { ok: false, code: "CONTRACT_ANCHOR_MISMATCH", block };
  }

  if (block.content.length > maxChars) {
    return { ok: false, code: "CONTRACT_TOO_LARGE", block };
  }

  if (forbidMarkersInside) {
    if (
      block.content.includes("<<<INSERT_START>>>") ||
      block.content.includes("<<<INSERT_END>>>") ||
      block.content.includes("<<<FILE_START>>>") ||
      block.content.includes("<<<FILE_END>>>")
    ) {
      return { ok: false, code: "CONTRACT_NESTED_MARKERS", block };
    }
  }

  return { ok: true, code: "OK", block };
}

// ==============================
// Shared helpers (optional use)
// ==============================
export const CONTRACT_LIMITS = {
  MAX_FULLFILE_CHARS_DEFAULT,
  MAX_INSERT_CHARS_DEFAULT,
};
