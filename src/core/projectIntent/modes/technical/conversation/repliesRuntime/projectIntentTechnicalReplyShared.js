// src/core/projectIntent/modes/technical/conversation/repliesRuntime/projectIntentTechnicalReplyShared.js
// ============================================================================
// TECHNICAL MODE REPLIES RUNTIME SHARED HELPERS
//
// INTERFACE MODE NOTE:
// - Shared helpers for legacy Technical Mode repo reply runtime.
// - This is not Human Mode intelligence.
// - Do not add phrase-bound Human Mode behavior here.
// ============================================================================

export const LARGE_DOC_AI_THRESHOLD = 12000;

export function pickProjectContextScope(...candidates) {
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      Object.keys(candidate).length > 0
    ) {
      return candidate;
    }
  }

  return {};
}

export default {
  LARGE_DOC_AI_THRESHOLD,
  pickProjectContextScope,
};
