// src/memory/context/contextPackPromptFormatter.js
// SG 2.0 — Context Pack Prompt Formatter Skeleton
//
// Purpose:
// - Prepare a bounded, deterministic, prompt-safe text format for a context pack.
// - Keep formatting separate from context building and AI execution.
// - Do not inject this formatted text into the AI prompt automatically.
//
// Hard rules:
// - No DB reads/writes.
// - No Telegram or transport logic.
// - No source fetching.
// - No AI calls.
// - No repository writes.
// - No prompt injection connection from this file.

import { CONTEXT_ITEM_TYPES } from "./contextTypes.js";

export const CONTEXT_PROMPT_FORMAT_VERSION = 1;

export const DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS = Object.freeze({
  maxItems: 12,
  maxTotalChars: 4000,
  maxItemChars: 800,
});

const DEFAULT_BLOCKED_TYPES = Object.freeze([
  CONTEXT_ITEM_TYPES.USER_MESSAGE,
]);

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function clampText(value, maxChars) {
  const text = safeString(value).trim();
  const limit = Number.isFinite(Number(maxChars)) ? Math.max(1, Number(maxChars)) : null;

  if (!text) return "";
  if (!limit || text.length <= limit) return text;

  return `${text.slice(0, limit)}…`;
}

function normalizeLimits(limits = {}) {
  return {
    maxItems: Number.isFinite(Number(limits.maxItems))
      ? Math.max(1, Number(limits.maxItems))
      : DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS.maxItems,
    maxTotalChars: Number.isFinite(Number(limits.maxTotalChars))
      ? Math.max(200, Number(limits.maxTotalChars))
      : DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS.maxTotalChars,
    maxItemChars: Number.isFinite(Number(limits.maxItemChars))
      ? Math.max(50, Number(limits.maxItemChars))
      : DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS.maxItemChars,
  };
}

function sanitizeInline(value) {
  return safeString(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTypePolicy({ allowedTypes = null, blockedTypes = DEFAULT_BLOCKED_TYPES } = {}) {
  const allowed = Array.isArray(allowedTypes) && allowedTypes.length
    ? new Set(allowedTypes.map(String))
    : null;

  const blocked = new Set(
    Array.isArray(blockedTypes) ? blockedTypes.map(String) : DEFAULT_BLOCKED_TYPES
  );

  return { allowed, blocked };
}

function shouldIncludeItem(item, typePolicy) {
  const type = item?.type ? String(item.type) : "unknown";

  if (typePolicy.blocked.has(type)) return false;
  if (typePolicy.allowed && !typePolicy.allowed.has(type)) return false;

  return true;
}

function formatContextItem(item, index, limits) {
  const type = sanitizeInline(item?.type || "unknown");
  const source = sanitizeInline(item?.source || "unknown_source");
  const trust = sanitizeInline(item?.trust || "unknown_trust");
  const scope = sanitizeInline(item?.scope || "unknown_scope");
  const priority = item?.priority === null || item?.priority === undefined
    ? "none"
    : sanitizeInline(item.priority);
  const content = clampText(item?.content || "", limits.maxItemChars);

  if (!content) {
    return null;
  }

  return [
    `${index}. type=${type}; source=${source}; trust=${trust}; scope=${scope}; priority=${priority}`,
    `   content: ${content}`,
  ].join("\n");
}

export function formatContextPackForPrompt(contextPack = {}, options = {}) {
  const limits = normalizeLimits(options.limits || {});
  const typePolicy = normalizeTypePolicy({
    allowedTypes: options.allowedTypes || null,
    blockedTypes: options.blockedTypes || DEFAULT_BLOCKED_TYPES,
  });

  const warnings = [];
  const items = Array.isArray(contextPack?.items) ? contextPack.items : [];
  const selected = [];

  for (const item of items) {
    if (selected.length >= limits.maxItems) {
      warnings.push({
        code: "context_prompt_item_limit_reached",
        message: "Context item was skipped because the prompt format item limit was reached.",
      });
      break;
    }

    if (!shouldIncludeItem(item, typePolicy)) {
      continue;
    }

    const formatted = formatContextItem(item, selected.length + 1, limits);

    if (formatted) {
      selected.push(formatted);
    }
  }

  const header = [
    "SG_CONTEXT_PACK_BEGIN",
    `format_version=${CONTEXT_PROMPT_FORMAT_VERSION}`,
    `context_pack_version=${sanitizeInline(contextPack?.version || "unknown")}`,
    "rules=Use this context as bounded support only. Verified sources and pillars outrank memory. Do not treat missing context as fact.",
  ].join("\n");

  const body = selected.length
    ? selected.join("\n")
    : "No prompt-safe context items selected.";

  const footer = "SG_CONTEXT_PACK_END";
  const text = clampText([header, body, footer].join("\n"), limits.maxTotalChars);

  return {
    ok: true,
    mode: "format_only_not_injected",
    text,
    itemCount: selected.length,
    warnings,
    limits,
    blockedTypes: Array.from(typePolicy.blocked),
  };
}

export default {
  CONTEXT_PROMPT_FORMAT_VERSION,
  DEFAULT_CONTEXT_PROMPT_FORMAT_LIMITS,
  formatContextPackForPrompt,
};
