// src/core/projectIntent/conversation/projectIntentConversationAiMessages.js
// ============================================================================
// LEGACY TECHNICAL MODE AI MESSAGES FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - Legacy repo/file AI prompt construction stays under Technical Mode.
// - Public exports are kept compatible.
// - Runtime AI message logic is unchanged; this file only re-exports the same
//   legacy logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalAiMessages.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalAiMessages.js";
