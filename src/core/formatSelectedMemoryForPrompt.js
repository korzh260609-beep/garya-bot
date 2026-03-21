// src/core/formatSelectedMemoryForPrompt.js
// STAGE 11+ — prompt-safe formatter for selected long-term memory
//
// GOAL:
// - take already selected long-term memory items
// - convert them into compact deterministic prompt-safe block
// - NO AI
// - NO DB
// - NO side effects
// - NOT injected into response flow yet
//
// INPUT:
// formatSelectedMemoryForPrompt({
//   items = [],
//   header = "LONG_TERM_MEMORY",
//   maxItems = 12,
//   maxValueLength = 240,
// })
//
// OUTPUT EXAMPLE:
// [LONG_TERM_MEMORY]
// - type=user_profile | key=name | value=Gary
// - type=project_rule | key=answer_mode | value=short
// [/LONG_TERM_MEMORY]

function _safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function _normalizeInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _oneLine(text) {
  return _safeStr(text).replace(/\s+/g, " ").trim();
}

function _clip(text, maxLen) {
  const s = _oneLine(text);
  if (!s) return "";
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return s.slice(0, maxLen);
  return `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function _normalizeHeader(header) {
  const h = _oneLine(header).replace(/[^\w.-]+/g, "_");
  return h || "LONG_TERM_MEMORY";
}

function _normalizeItem(raw = {}) {
  return {
    id: raw?.id ?? null,
    rememberType: _oneLine(raw?.rememberType),
    rememberKey: _oneLine(raw?.rememberKey),
    value: _oneLine(raw?.value),
    createdAt: _safeStr(raw?.createdAt).trim() || null,
    explicit: raw?.explicit === true,
  };
}

export function formatSelectedMemoryForPrompt({
  items = [],
  header = "LONG_TERM_MEMORY",
  maxItems = 12,
  maxValueLength = 240,
} = {}) {
  const safeHeader = _normalizeHeader(header);
  const safeMaxItems = _normalizeInt(maxItems, 12, 1, 100);
  const safeMaxValueLength = _normalizeInt(maxValueLength, 240, 16, 2000);

  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  const normalized = items
    .slice(0, safeMaxItems)
    .map((item) => _normalizeItem(item))
    .filter((item) => item.value);

  if (normalized.length === 0) {
    return "";
  }

  const lines = [`[${safeHeader}]`];

  for (const item of normalized) {
    const rememberType = item.rememberType || "—";
    const rememberKey = item.rememberKey || "—";
    const value = _clip(item.value, safeMaxValueLength);

    lines.push(`- type=${rememberType} | key=${rememberKey} | value=${value}`);
  }

  lines.push(`[/${safeHeader}]`);
  return lines.join("\n");
}

export default formatSelectedMemoryForPrompt;