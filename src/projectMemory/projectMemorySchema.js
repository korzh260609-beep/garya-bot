// src/projectMemory/projectMemorySchema.js
// ============================================================================
// Project Memory V2 schema helpers
// Purpose:
// - normalize entry types / statuses / source types / layers
// - keep project memory universal across Telegram / Discord / Web UI / API
// - avoid tying logic to specific phrases or transport-specific assumptions
// - keep layer resolution based on structured entry semantics, not message text
// ============================================================================

import {
  PROJECT_MEMORY_LAYERS,
  PROJECT_MEMORY_LAYER_VALUES,
  normalizeProjectMemoryLayer,
  resolveProjectMemoryLayerByEntryType,
} from "./projectMemoryLayers.js";

export const PROJECT_MEMORY_ENTRY_TYPES = Object.freeze({
  SECTION_STATE: "section_state",
  DECISION: "decision",
  IMPLEMENTATION_NOTE: "implementation_note",
  SESSION_SUMMARY: "session_summary",
  CONSTRAINT: "constraint",
  RISK: "risk",
  NEXT_STEP: "next_step",
  MODULE_STATE: "module_state",
  SOURCE_SYNC: "source_sync",
});

export const PROJECT_MEMORY_STATUSES = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
  SUPERSEDED: "superseded",
  DRAFT: "draft",
});

export const PROJECT_MEMORY_SOURCE_TYPES = Object.freeze({
  MANUAL: "manual",
  SYSTEM: "system",
  REPO_FILE: "repo_file",
  CHAT_SESSION: "chat_session",
  API: "api",
  TRANSPORT: "transport",
  UNKNOWN: "unknown",
});

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeNullableText(value) {
  const s = normalizeText(value);
  return s || null;
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = normalizeText(item);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

export function normalizeEntryType(value) {
  const s = normalizeText(value);
  return Object.values(PROJECT_MEMORY_ENTRY_TYPES).includes(s)
    ? s
    : PROJECT_MEMORY_ENTRY_TYPES.SECTION_STATE;
}

export function normalizeStatus(value) {
  const s = normalizeText(value);
  return Object.values(PROJECT_MEMORY_STATUSES).includes(s)
    ? s
    : PROJECT_MEMORY_STATUSES.ACTIVE;
}

export function normalizeSourceType(value) {
  const s = normalizeText(value);
  return Object.values(PROJECT_MEMORY_SOURCE_TYPES).includes(s)
    ? s
    : PROJECT_MEMORY_SOURCE_TYPES.UNKNOWN;
}

export function normalizeConfidence(value, def = 0.7) {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function normalizeBoolean(value, def = true) {
  if (typeof value === "boolean") return value;
  return def;
}

export function normalizeProjectMemoryMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export function normalizeLayerForEntry({ layer, entryType } = {}) {
  const normalizedEntryType = normalizeEntryType(entryType);
  const fallbackLayer = resolveProjectMemoryLayerByEntryType(normalizedEntryType);

  return normalizeProjectMemoryLayer(layer, fallbackLayer);
}

export function buildNormalizedProjectMemoryInput(input = {}) {
  const entryType = normalizeEntryType(input.entryType);
  const layer = normalizeLayerForEntry({
    layer: input.layer,
    entryType,
  });

  return {
    projectKey: normalizeText(input.projectKey) || "garya_ai",
    section: normalizeText(input.section),
    title: normalizeNullableText(input.title),
    content: normalizeText(input.content),
    tags: normalizeStringArray(input.tags),
    meta: normalizeProjectMemoryMeta(input.meta),
    schemaVersion: Number.isInteger(input.schemaVersion) ? input.schemaVersion : 2,

    layer,
    entryType,
    status: normalizeStatus(input.status),
    sourceType: normalizeSourceType(input.sourceType),
    sourceRef: normalizeNullableText(input.sourceRef),
    relatedPaths: normalizeStringArray(input.relatedPaths),
    moduleKey: normalizeNullableText(input.moduleKey),
    stageKey: normalizeNullableText(input.stageKey),
    confidence: normalizeConfidence(input.confidence, 0.7),
    isActive: normalizeBoolean(input.isActive, true),
  };
}

export default {
  PROJECT_MEMORY_ENTRY_TYPES,
  PROJECT_MEMORY_STATUSES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_LAYERS,
  PROJECT_MEMORY_LAYER_VALUES,
  buildNormalizedProjectMemoryInput,
  normalizeText,
  normalizeNullableText,
  normalizeStringArray,
  normalizeEntryType,
  normalizeStatus,
  normalizeSourceType,
  normalizeConfidence,
  normalizeBoolean,
  normalizeProjectMemoryMeta,
  normalizeLayerForEntry,
};