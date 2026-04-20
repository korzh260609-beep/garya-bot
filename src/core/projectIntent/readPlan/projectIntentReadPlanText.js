// src/core/projectIntent/readPlan/projectIntentReadPlanText.js

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"\'`~@#$%^&*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export default {
  normalizeText,
  tokenizeText,
  unique,
  pickFirstNonEmpty,
};