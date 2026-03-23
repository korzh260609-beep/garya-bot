// src/core/buildLegacyExplicitRememberPair.js
//
// Goal:
// - move legacy explicit-remember pair extraction OUT of handleExplicitRemember.js
// - keep behavior identical
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT save memory
// - this helper does NOT run V2
// - this helper only builds legacy key/value pair

import {
  classifyExplicitRememberKey,
  extractExplicitRememberValue,
} from "./explicitRememberKey.js";

export function buildLegacyExplicitRememberPair(rememberRawValue) {
  const legacyRememberKey = classifyExplicitRememberKey(rememberRawValue);
  const legacyRememberValue = String(
    extractExplicitRememberValue(rememberRawValue) || rememberRawValue
  ).trim();

  return {
    legacyRememberKey,
    legacyRememberValue,
  };
}

export default buildLegacyExplicitRememberPair;