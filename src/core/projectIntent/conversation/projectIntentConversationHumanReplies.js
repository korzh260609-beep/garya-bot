// src/core/projectIntent/conversation/projectIntentConversationHumanReplies.js
// ============================================================================
// LEGACY TECHNICAL MODE HUMAN-STYLE REPLIES FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Despite the old filename, these are legacy human-readable templates for
//   Technical Mode repo conversation flows, not full Human Mode.
// - Public exports are kept compatible.
// - Runtime reply template logic is unchanged; this file only re-exports the
//   same legacy logic through the Technical Mode boundary.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalHumanReplies.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalHumanReplies.js";
