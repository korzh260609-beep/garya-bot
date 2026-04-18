// ============================================================================
// === src/core/stageCheck/real/profileSkeleton/profileFamilies.js
// === non-runtime skeleton: canonical profile families
// ============================================================================

export const PROFILE_FAMILIES = Object.freeze([
  "foundation",
  "feature",
  "integration",
  "policy",
  "output",
  "generic",
]);

export function isValidProfileFamily(value) {
  return PROFILE_FAMILIES.includes(String(value || "").trim());
}

export default {
  PROFILE_FAMILIES,
  isValidProfileFamily,
};