// src/core/projectIntent/conversation/projectIntentConversationBootstrap.js
// ============================================================================
// LEGACY TECHNICAL MODE CONVERSATION BOOTSTRAP FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Legacy repo conversation bootstrap depends on Technical routeKey and legacy
//   snapshot availability.
// - Public exports are kept compatible.
// - Runtime bootstrap logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalBootstrap.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalBootstrap.js";
