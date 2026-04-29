// src/core/projectIntent/conversation/projectIntentConversationStructuredRead.js
// ============================================================================
// LEGACY TECHNICAL MODE STRUCTURED READ FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Slash command extraction, command-list detection and command importance
//   checks are Technical Mode behavior.
// - Public exports are kept compatible.
// - Runtime structured-read logic is unchanged; this file only re-exports the
//   same legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalStructuredRead.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalStructuredRead.js";
