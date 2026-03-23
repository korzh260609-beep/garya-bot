// src/core/runMemoryClassifierV2Shadow.js
//
// Goal:
// - provide reusable V2 shadow runner for memory-entry points
// - keep behavior deterministic
// - no DB
// - no memory saving
// - no adoption decisions
// - no runtime behavior changes by itself
//
// IMPORTANT:
// - this helper only runs V2 shadow path
// - caller remains responsible for legacy extraction, remember plan, and saving
// - returns v2Result or null

import { classifyMemoryCandidateV2 } from "./classifyMemoryCandidateV2.js";
import {
  buildShadowComparison,
  logMemoryClassifierV2Shadow,
  shouldRunMemoryClassifierV2Shadow,
} from "./memoryClassifierV2RuntimeDecision.js";

export function runMemoryClassifierV2Shadow({
  inputText,
  legacyKey,
  legacyValue,
  runtimeConfig,
}) {
  if (!shouldRunMemoryClassifierV2Shadow(runtimeConfig)) {
    return null;
  }

  try {
    const v2Result = classifyMemoryCandidateV2({
      text: inputText,
    });

    const shadowPayload = buildShadowComparison({
      rememberRawValue: inputText,
      legacyKey,
      legacyValue,
      v2Result,
    });

    logMemoryClassifierV2Shadow(shadowPayload);

    return v2Result;
  } catch (e) {
    console.error("memoryClassifierV2 shadow failed:", e);
    return null;
  }
}

export default runMemoryClassifierV2Shadow;