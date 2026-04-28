// src/core/projectIntent/readPlan/projectIntentReadPlanSignals.js
// ============================================================================
// LEGACY PHRASE/TOKEN/PREFIX SIGNALS MARKER
//
// INTERFACE MODE NOTE:
// - This file provides deterministic phrase/token/prefix matching helpers.
// - Under hard Human Mode / Technical Mode separation, this is NOT full Human Mode.
// - Treat this as legacy Technical Mode support until a clean structured meaning
//   layer replaces it.
// - Do not add new phrase-bound hacks here.
// ============================================================================

import { unique } from "./projectIntentReadPlanText.js";

export function collectPhraseHits(normalized, markers) {
  if (!normalized) return [];
  return unique(markers.filter((marker) => normalized.includes(marker)));
}

export function collectTokenHits(tokens, markers) {
  if (!tokens.length) return [];
  const tokenSet = new Set(tokens);
  return unique(markers.filter((marker) => tokenSet.has(marker)));
}

export function collectPrefixHits(tokens, prefixes) {
  const hits = [];

  for (const token of tokens) {
    for (const prefix of prefixes) {
      if (token.startsWith(prefix)) {
        hits.push(token);
        break;
      }
    }
  }

  return unique(hits);
}

export default {
  collectPhraseHits,
  collectTokenHits,
  collectPrefixHits,
};