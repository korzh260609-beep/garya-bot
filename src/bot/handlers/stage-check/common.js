// ============================================================================
// === src/bot/handlers/stage-check/common.js
// ============================================================================

const CYRILLIC_TO_LATIN_MAP = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
  І: "I",
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  х: "x",
  і: "i",
};

export function replaceLookalikeCyrillic(value) {
  return String(value || "")
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN_MAP[ch] || ch)
    .join("");
}

export function normalizeItemCode(value) {
  return replaceLookalikeCyrillic(
    String(value || "")
      .trim()
      .replace(/^stage\s+/i, "")
  ).toUpperCase();
}

export function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch {
    return null;
  }
}

export function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

export function getParentCode(code) {
  const value = normalizeItemCode(code);
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  return value.slice(0, lastDot);
}

export function isSameOrDescendant(baseCode, candidateCode) {
  const base = normalizeItemCode(baseCode);
  const candidate = normalizeItemCode(candidateCode);
  return candidate === base || candidate.startsWith(`${base}.`);
}

export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}