// src/core/memory/MemoryLayerPolicy.js
// STAGE 7.8.3 — CONFIRMED MEMORY SEPARATION POLICY (SKELETON)
//
// Goal:
// - define explicit boundaries between memory layers
// - prevent raw archive from being treated as confirmed memory
// - prevent topic digest from being treated as confirmed memory
// - prevent confirmed memory from being mixed with archive/digest metadata
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO writes here.
// - This module is deterministic policy/diagnostic only.

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

export const MEMORY_LAYER_POLICY_VERSION = "memory-layer-policy-7.8.3-001";

export const MEMORY_LAYERS = Object.freeze({
  CONFIRMED: "confirmed_memory",
  ARCHIVE: "raw_dialogue_archive",
  DIGEST: "topic_digest",
});

export const MEMORY_LAYER_RULES = Object.freeze({
  [MEMORY_LAYERS.CONFIRMED]: Object.freeze({
    layer: MEMORY_LAYERS.CONFIRMED,
    confirmedMemory: true,
    archiveMemory: false,
    digestMemory: false,
    promptFacingByDefault: false,
    rawPromptInjectionAllowed: false,
    writePath: "MemoryService.remember -> MemoryWriteService.remember",
    description: "Explicitly confirmed durable facts only.",
  }),
  [MEMORY_LAYERS.ARCHIVE]: Object.freeze({
    layer: MEMORY_LAYERS.ARCHIVE,
    confirmedMemory: false,
    archiveMemory: true,
    digestMemory: false,
    promptFacingByDefault: false,
    rawPromptInjectionAllowed: false,
    writePath: "MemoryService.archiveMessage/archivePair",
    description: "Raw dialogue archive; restore-capable, not prompt-facing by default.",
  }),
  [MEMORY_LAYERS.DIGEST]: Object.freeze({
    layer: MEMORY_LAYERS.DIGEST,
    confirmedMemory: false,
    archiveMemory: false,
    digestMemory: true,
    promptFacingByDefault: false,
    rawPromptInjectionAllowed: false,
    writePath: "MemoryService.upsertTopicDigest",
    description: "Compact topic summary; not a confirmed fact by itself.",
  }),
});

export function getMemoryLayerPolicy() {
  return {
    ok: true,
    version: MEMORY_LAYER_POLICY_VERSION,
    layers: MEMORY_LAYERS,
    rules: MEMORY_LAYER_RULES,
    invariants: [
      "confirmed_memory must not be created from raw dialogue automatically",
      "raw_dialogue_archive must not be injected into prompts without an explicit bounded restore path",
      "topic_digest must not be treated as confirmed fact",
      "handlers must call MemoryService only",
      "DB schema changes require a separate approved plan",
    ],
  };
}

export function classifyMemoryLayer(metadata = {}) {
  const meta = _safeObj(metadata);

  const memoryLayer = _safeStr(meta.memoryLayer).trim();
  if (memoryLayer && MEMORY_LAYER_RULES[memoryLayer]) {
    return MEMORY_LAYER_RULES[memoryLayer];
  }

  const memoryType = _safeStr(meta.memoryType).trim();
  const explicit = meta.explicit === true || _safeStr(meta.explicit).trim() === "true";

  if (memoryType === "long_term" && explicit) {
    return MEMORY_LAYER_RULES[MEMORY_LAYERS.CONFIRMED];
  }

  const archiveKind = _safeStr(meta.archiveKind).trim();
  if (archiveKind === "raw_dialogue") {
    return MEMORY_LAYER_RULES[MEMORY_LAYERS.ARCHIVE];
  }

  const digestKind = _safeStr(meta.digestKind).trim();
  if (digestKind === "topic_summary") {
    return MEMORY_LAYER_RULES[MEMORY_LAYERS.DIGEST];
  }

  return {
    layer: "unknown",
    confirmedMemory: false,
    archiveMemory: false,
    digestMemory: false,
    promptFacingByDefault: false,
    rawPromptInjectionAllowed: false,
    writePath: "unknown",
    description: "Unknown or legacy memory row; treat as not confirmed unless explicitly selected by a safe service.",
  };
}

export function assertMemoryLayerSeparation(metadata = {}) {
  const meta = _safeObj(metadata);
  const layerRule = classifyMemoryLayer(meta);
  const errors = [];

  const memoryLayer = _safeStr(meta.memoryLayer).trim();
  const memoryType = _safeStr(meta.memoryType).trim();
  const archiveKind = _safeStr(meta.archiveKind).trim();
  const digestKind = _safeStr(meta.digestKind).trim();

  const declaresConfirmed =
    memoryLayer === MEMORY_LAYERS.CONFIRMED ||
    (memoryType === "long_term" &&
      (meta.explicit === true || _safeStr(meta.explicit).trim() === "true"));
  const declaresArchive =
    memoryLayer === MEMORY_LAYERS.ARCHIVE || archiveKind === "raw_dialogue";
  const declaresDigest =
    memoryLayer === MEMORY_LAYERS.DIGEST || digestKind === "topic_summary";

  const declaredCount = [declaresConfirmed, declaresArchive, declaresDigest].filter(Boolean).length;

  if (declaredCount > 1) {
    errors.push("mixed_memory_layers");
  }

  if (declaresArchive && meta.confirmedMemory === true) {
    errors.push("archive_marked_as_confirmed");
  }

  if (declaresDigest && meta.confirmedMemory === true) {
    errors.push("digest_marked_as_confirmed");
  }

  if (meta.rawPromptInjectionAllowed === true) {
    errors.push("raw_prompt_injection_allowed");
  }

  return {
    ok: errors.length === 0,
    errors,
    layer: layerRule.layer,
    rule: layerRule,
    version: MEMORY_LAYER_POLICY_VERSION,
  };
}

export default {
  MEMORY_LAYER_POLICY_VERSION,
  MEMORY_LAYERS,
  MEMORY_LAYER_RULES,
  getMemoryLayerPolicy,
  classifyMemoryLayer,
  assertMemoryLayerSeparation,
};
