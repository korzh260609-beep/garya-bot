// src/core/projectIntent/conversation/projectIntentConversationAiGuard.js
// ============================================================================
// LEGACY TECHNICAL MODE AI GUARD FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Deterministic pattern/includes grounding checks are Technical Mode guard
//   behavior.
// - Public exports are kept compatible.
// - Runtime guard logic is unchanged; this file only re-exports the same legacy
//   logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalAiGuard.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalAiGuard.js";
