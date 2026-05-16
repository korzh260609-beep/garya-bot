// src/ai/runtime/index.js
// SG 2.0 — AI Runtime public boundary.
// Purpose: expose runtime-facing AI orchestration primitives without binding them to providers.
// Do not add AI provider calls, Telegram logic, source fetching, repository mutation, runtime writes, or env changes here.

export {
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION,
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES,
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS,
  buildAiToolRuntimeInvocationBridgeStatus,
  getAiToolRuntimeInvocationBridgeBoundaries,
  invokeAiToolFromRuntime,
} from "./aiToolRuntimeInvocationBridge.js";
