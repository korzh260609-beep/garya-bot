// src/core/projectIntent/projectIntentConversationShared.js

export function safeText(value) {
  return String(value ?? "").trim();
}

export function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'\`~@#$%^&*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function normalizePath(raw) {
  const p = safeText(raw).replace(/^\/+/, "");
  if (!p) return "";
  if (p.includes("..")) return "";
  return p;
}

export function sanitizeEntity(value) {
  return safeText(value)
    .replace(/^[`"'«“„]+/, "")
    .replace(/[`"'»”„]+$/, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}