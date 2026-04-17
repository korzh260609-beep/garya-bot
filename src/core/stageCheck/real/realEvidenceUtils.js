// ============================================================================
// === src/core/stageCheck/real/realEvidenceUtils.js
// === shared helpers for real-evidence collection
// ============================================================================

import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";

export function uniq(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

export function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+/, "")
    .replace(/['"]+$/, "");
}

export function lower(value) {
  return String(value || "").toLowerCase();
}

export function includesAny(text, tokens = []) {
  const hay = lower(text);
  return (tokens || []).some((x) => hay.includes(lower(x)));
}

export function includesAll(text, tokens = []) {
  const hay = lower(text);
  return (tokens || []).every((x) => hay.includes(lower(x)));
}

export function getExtension(path) {
  const value = String(path || "").trim().toLowerCase();
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index) : "";
}

export function isLikelyDescriptiveFile(path) {
  const filePath = String(path || "").trim().toLowerCase();
  const ext = getExtension(filePath);

  if (filePath.startsWith("pillars/")) return true;
  if (filePath.includes("/docs/")) return true;
  if (filePath.includes("/doc/")) return true;

  return (
    ext === ".md" ||
    ext === ".txt" ||
    ext === ".yaml" ||
    ext === ".yml"
  );
}

export function isLikelyRuntimeProofFile(path) {
  const ext = getExtension(path);
  return (
    ext === ".js" ||
    ext === ".mjs" ||
    ext === ".cjs" ||
    ext === ".ts" ||
    ext === ".mts" ||
    ext === ".cts" ||
    ext === ".sql" ||
    ext === ".json"
  );
}

export async function safeReadJson(path, evaluationCtx) {
  try {
    const text = await safeFetchTextFile(path, evaluationCtx);
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}
