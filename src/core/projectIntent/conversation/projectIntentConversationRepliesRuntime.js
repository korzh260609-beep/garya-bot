// src/core/projectIntent/conversation/projectIntentConversationRepliesRuntime.js
// ============================================================================
// LEGACY TECHNICAL MODE REPLIES RUNTIME FACADE MARKER
//
// INTERFACE MODE NOTE:
// - This public compatibility facade now points explicitly to Technical Mode.
// - The legacy replies runtime has been split into logical Technical Mode blocks:
//   shared, packed/continuation, folder replies and file replies.
// - Public exports are kept compatible.
// - Runtime reply logic is unchanged; this file only re-exports the same legacy
//   logic through the Technical Mode boundary.
// - This is NOT full Human Mode.
// ============================================================================

export * from "../modes/technical/conversation/projectIntentTechnicalRepliesRuntime.js";
export { default } from "../modes/technical/conversation/projectIntentTechnicalRepliesRuntime.js";
