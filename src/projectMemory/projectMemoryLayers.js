// src/projectMemory/projectMemoryLayers.js
// ============================================================================
// Project Memory Layers
// Stage: 7A — Project Memory Layer
// Purpose:
// - define first-class logical memory layers required by D-018A
// - keep raw archive, topic digest, and confirmed memory logically separate
// - provide a single source of truth before DB migration / service integration
// - no DB calls
// - no writes
// - no transport assumptions
// ============================================================================

export const PROJECT_MEMORY_LAYERS = Object.freeze({
  RAW_ARCHIVE: "raw_archive",
  TOPIC_DIGEST: "topic_digest",
  CONFIRMED: "confirmed",
});

export const PROJECT_MEMORY_LAYER_VALUES = Object.freeze(
  Object.values(PROJECT_MEMORY_LAYERS)
);

const CONFIRMED_ENTRY_TYPES = new Set([
  "section_state",
  "decision",
  "constraint",
  "next_step",
]);

const TOPIC_DIGEST_ENTRY_TYPES = new Set([
  "session_summary",
  "topic_digest",
]);

function safeText(value) {
  return String(value ?? "").trim();
}

export function isProjectMemoryLayer(value) {
  return PROJECT_MEMORY_LAYER_VALUES.includes(safeText(value));
}

export function normalizeProjectMemoryLayer(value, fallback = PROJECT_MEMORY_LAYERS.CONFIRMED) {
  const normalized = safeText(value);

  if (isProjectMemoryLayer(normalized)) {
    return normalized;
  }

  return isProjectMemoryLayer(fallback)
    ? fallback
    : PROJECT_MEMORY_LAYERS.CONFIRMED;
}

export function isConfirmedProjectMemoryLayer(value) {
  return normalizeProjectMemoryLayer(value) === PROJECT_MEMORY_LAYERS.CONFIRMED;
}

export function resolveProjectMemoryLayerByEntryType(entryType) {
  const normalizedEntryType = safeText(entryType);

  if (CONFIRMED_ENTRY_TYPES.has(normalizedEntryType)) {
    return PROJECT_MEMORY_LAYERS.CONFIRMED;
  }

  if (TOPIC_DIGEST_ENTRY_TYPES.has(normalizedEntryType)) {
    return PROJECT_MEMORY_LAYERS.TOPIC_DIGEST;
  }

  return PROJECT_MEMORY_LAYERS.RAW_ARCHIVE;
}

export function isConfirmedProjectMemoryEntryType(entryType) {
  return CONFIRMED_ENTRY_TYPES.has(safeText(entryType));
}

export function isTopicDigestProjectMemoryEntryType(entryType) {
  return TOPIC_DIGEST_ENTRY_TYPES.has(safeText(entryType));
}

export default {
  PROJECT_MEMORY_LAYERS,
  PROJECT_MEMORY_LAYER_VALUES,
  isProjectMemoryLayer,
  normalizeProjectMemoryLayer,
  isConfirmedProjectMemoryLayer,
  resolveProjectMemoryLayerByEntryType,
  isConfirmedProjectMemoryEntryType,
  isTopicDigestProjectMemoryEntryType,
};
