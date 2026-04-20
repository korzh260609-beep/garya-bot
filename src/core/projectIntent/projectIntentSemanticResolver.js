// src/core/projectIntent/projectIntentSemanticResolver.js
// ============================================================================
// STAGE 12A.0 — semantic resolver for internal repo dialogue
// Orchestrator/facade only
// ============================================================================

import { safeJsonParse } from "./semantic/projectIntentSemanticText.js";
import { heuristicFallback } from "./semantic/projectIntentSemanticFallback.js";
import { buildSemanticMessages } from "./semantic/projectIntentSemanticMessages.js";
import { sanitizeSemanticResult } from "./semantic/projectIntentSemanticSanitizer.js";

export async function resolveProjectIntentSemanticPlan({
  text,
  callAI,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const fallback = heuristicFallback({
    text,
    followupContext,
    pendingChoiceContext,
  });

  if (typeof callAI !== "function") {
    return fallback;
  }

  try {
    const aiReply = await callAI(
      buildSemanticMessages({
        text,
        followupContext,
        pendingChoiceContext,
      }),
      "high",
      {
        max_completion_tokens: 260,
        temperature: 0.1,
      }
    );

    const parsed = safeJsonParse(aiReply);
    return sanitizeSemanticResult(parsed, fallback);
  } catch {
    return fallback;
  }
}

export default {
  resolveProjectIntentSemanticPlan,
};