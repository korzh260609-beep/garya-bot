// src/ai/tools/index.js
// SG 2.0 — AI Tools public boundary.
// Purpose: expose deterministic tool registry primitives without binding them to runtime AI calls.
// Do not add provider calls, Telegram logic, source fetching, repository mutation, or env changes here.

export {
  AI_TOOL_REGISTRY_VERSION,
  AI_TOOL_REGISTRY_MODES,
  AI_TOOL_NAMES,
  AI_TOOL_REGISTRY_DECISIONS,
  buildAiToolRegistryStatus,
  getAiToolRegistryBoundaries,
  listAiToolManifests,
  findAiToolManifest,
  runAiTool,
} from "./aiToolRegistry.js";
