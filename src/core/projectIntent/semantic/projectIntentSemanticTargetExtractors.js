// src/core/projectIntent/semantic/projectIntentSemanticTargetExtractors.js

import { GENERIC_TARGET_WORDS } from "./projectIntentSemanticConstants.js";
import { safeText, normalizeText, unique } from "./projectIntentSemanticText.js";

export function sanitizeTargetText(value) {
  return safeText(value)
    .replace(/^[`"'«“„]+/, "")
    .replace(/[`"'»”„]+$/, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}

export function isLikelyPathOrFileToken(value) {
  const v = sanitizeTargetText(value);
  if (!v) return false;
  if (v.includes("/")) return true;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return true;
  if (/^[a-z0-9_.-]+$/i.test(v) && v.length >= 3) return true;
  return false;
}

export function isLikelyBasename(value) {
  const v = sanitizeTargetText(value);
  return /\.[a-z0-9]{1,8}$/i.test(v) && !v.includes("/");
}

export function looksLikeFolderTarget(value) {
  const v = sanitizeTargetText(value);
  if (!v) return false;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return false;
  return v.includes("/") || /^[A-Za-z0-9_.-]+$/.test(v);
}

export function inferObjectKindFromTarget(value = "") {
  const v = sanitizeTargetText(value);
  if (!v) return "unknown";
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return "file";
  if (looksLikeFolderTarget(v)) return "folder";
  return "unknown";
}

export function extractQuotedTargets(text = "") {
  const raw = safeText(text);
  const matches = [];

  const regexes = [
    /`([^`]{2,120})`/g,
    /\"([^\"]{2,120})\"/g,
    /«([^»]{2,120})»/g,
  ];

  for (const rx of regexes) {
    let m;
    while ((m = rx.exec(raw)) !== null) {
      const candidate = sanitizeTargetText(m[1]);
      if (candidate) matches.push(candidate);
    }
  }

  return unique(matches);
}

export function extractPathLikeTargets(text = "") {
  const raw = safeText(text);
  const matches = [];

  const rx = /\b([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\/?|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8})\b/g;
  let m;
  while ((m = rx.exec(raw)) !== null) {
    const candidate = sanitizeTargetText(m[1]);
    if (!candidate) continue;
    if (GENERIC_TARGET_WORDS.has(candidate.toLowerCase())) continue;
    if (candidate.length < 3) continue;
    if (isLikelyPathOrFileToken(candidate)) {
      matches.push(candidate);
    }
  }

  return unique(matches);
}

export function extractNamedTargetByMarker(text = "") {
  const raw = safeText(text);

  const patterns = [
    /(?:файл|документ|раздел|папк[ауеи]?|директори[яиюе]?|каталог|file|document|section|folder|directory)\s+([A-Za-z0-9_.\-\/]{3,120})/i,
    /(?:про|about|inside)\s+([A-Za-z0-9_.\-\/]{3,120})/i,
    /(?:внутри|в)\s+([A-Za-z0-9_.\-\/]{3,120}\/?)/i,
  ];

  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const candidate = sanitizeTargetText(m[1]);
    if (!candidate) continue;
    if (GENERIC_TARGET_WORDS.has(candidate.toLowerCase())) continue;
    return candidate;
  }

  return "";
}

export function extractTargetPhrase(text = "") {
  const quoted = extractQuotedTargets(text);
  if (quoted.length > 0) return quoted[0];

  const named = extractNamedTargetByMarker(text);
  if (named) return named;

  const pathLike = extractPathLikeTargets(text);
  if (pathLike.length > 0) return pathLike[0];

  return "";
}

export function extractTreePrefix(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return "";

  if (
    normalized.includes("корне") ||
    normalized.includes("в корне") ||
    normalized.includes("root")
  ) {
    return "";
  }

  const pathLike = extractPathLikeTargets(text);
  for (const item of pathLike) {
    if (item.includes("/") || /^[A-Za-z0-9_.-]+$/.test(item)) {
      return sanitizeTargetText(item).replace(/^\//, "");
    }
  }

  const m = safeText(text).match(/(?:покажи|раскрой|открой|show|open)\s+([A-Za-z0-9_.\-\/]{2,120}\/?)/i);
  if (m?.[1]) {
    return sanitizeTargetText(m[1]).replace(/^\//, "");
  }

  return "";
}

export function normalizeFolderTarget(target = "") {
  const v = sanitizeTargetText(target).replace(/^\//, "");
  if (!v) return "";
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return v;
  return v.endsWith("/") ? v : `${v}/`;
}