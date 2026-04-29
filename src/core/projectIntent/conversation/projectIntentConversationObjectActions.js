// src/core/projectIntent/conversation/projectIntentConversationObjectActions.js
// ============================================================================
// LEGACY TECHNICAL MODE OBJECT ACTIONS FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Legacy repo object open/explain actions stay under Technical Mode.
// - Public exports are kept compatible.
// - Runtime object action logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalObjectActions.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalObjectActions.js";
