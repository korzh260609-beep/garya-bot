// src/core/getExplicitRememberClassifierVersion.js
//
// Goal:
// - move classifierVersion selection OUT of metadata builder
// - keep behavior identical
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT save memory
// - this helper does NOT run V2
// - this helper only determines classifierVersion string

export function getExplicitRememberClassifierVersion(rememberPlan) {
  return rememberPlan?.selectedBy === "v2_safe_adoption" ? "v2" : "legacy";
}

export default getExplicitRememberClassifierVersion;