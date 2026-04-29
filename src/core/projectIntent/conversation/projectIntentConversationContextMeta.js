// src/core/projectIntent/conversation/projectIntentConversationContextMeta.js
// ============================================================================
// LEGACY TECHNICAL MODE CONTEXT META FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Legacy repo conversation context metadata stays under Technical Mode.
// - Public exports are kept compatible.
// - Runtime context meta logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalContextMeta.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalContextMeta.js";
