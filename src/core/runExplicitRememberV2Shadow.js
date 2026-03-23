// src/core/runExplicitRememberV2Shadow.js
//
// Goal:
// - keep explicit-remember shadow entrypoint backward-compatible
// - delegate reusable shadow logic to generic helper
// - no DB
// - no memory saving
// - no adoption decisions
// - deterministic only
//
// IMPORTANT:
// - this helper remains explicit-remember specific by API shape
// - actual V2 shadow execution is delegated to runMemoryClassifierV2Shadow()

import { runMemoryClassifierV2Shadow } from "./runMemoryClassifierV2Shadow.js";

export function runExplicitRememberV2Shadow({
  rememberRawValue,
  legacyKey,
  legacyValue,
  runtimeConfig,
}) {
  return runMemoryClassifierV2Shadow({
    inputText: rememberRawValue,
    legacyKey,
    legacyValue,
    runtimeConfig,
  });
}

export default runExplicitRememberV2Shadow;