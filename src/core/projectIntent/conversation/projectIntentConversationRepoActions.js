// src/core/projectIntent/conversation/projectIntentConversationRepoActions.js
// ============================================================================
// LEGACY TECHNICAL MODE REPO ACTIONS FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Legacy repo status/tree/search/browse/find actions stay under Technical Mode.
// - Public exports are kept compatible.
// - Runtime repo action logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalRepoActions.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalRepoActions.js";
