// src/core/runExplicitRememberV2Shadow.js
//
// Goal:
// - move V2 shadow execution OUT of handleExplicitRemember.js
// - keep behavior identical
// - no DB
// - no memory saving
// - no adoption decisions
// - deterministic only
//
// IMPORTANT:
// - this helper only runs V2 shadow path
// - legacy save path stays in handleExplicitRemember.js
// - runtimeConfig is passed from caller
// - returns v2Result or null

import { classifyMemoryCandidateV2 } from "./classifyMemoryCandidateV2.js";
import {
  buildShadowComparison,
  logMemoryClassifierV2Shadow,
  shouldRunMemoryClassifierV2Shadow,
} from "./memoryClassifierV2RuntimeDecision.js";

export function runExplicitRememberV2Shadow({
  rememberRawValue,
  legacyKey,
  legacyValue,
  runtimeConfig,
}) {
  if (!shouldRunMemoryClassifierV2Shadow(runtimeConfig)) {
    return null;
  }

  try {
    const v2Result = classifyMemoryCandidateV2({
      text: rememberRawValue,
    });

    const shadowPayload = buildShadowComparison({
      rememberRawValue,
      legacyKey,
      legacyValue,
      v2Result,
    });

    logMemoryClassifierV2Shadow(shadowPayload);

    return v2Result;
  } catch (e) {
    console.error("handleMessage(explicit remember shadow v2) failed:", e);
    return null;
  }
}

export default runExplicitRememberV2Shadow;