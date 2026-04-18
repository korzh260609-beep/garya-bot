// ============================================================================
// === src/core/stageCheck/real/profileSkeleton/profileResolverDraft.js
// === non-runtime skeleton: draft resolver for workflow subtree -> node profile
// ============================================================================

import { DEFAULT_STAGE_CHECK_PROFILES } from "./defaultProfiles.js";

function normalizeScopeItems(scopeWorkflowItems = []) {
  return Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
}

function buildScopeText(scopeWorkflowItems = []) {
  return normalizeScopeItems(scopeWorkflowItems)
    .map((item) => `${item?.code || ""} ${item?.title || ""}`.trim())
    .join(" ")
    .toLowerCase();
}

function countMatches(text, values = []) {
  let score = 0;

  for (const value of values) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) continue;
    if (text.includes(normalized)) score += 1;
  }

  return score;
}

export function resolveProfileDraft({
  scopeWorkflowItems,
  scopeSemanticProfile,
  profiles = DEFAULT_STAGE_CHECK_PROFILES,
} = {}) {
  const text = buildScopeText(scopeWorkflowItems);
  const tags = Array.isArray(scopeSemanticProfile?.tags)
    ? scopeSemanticProfile.tags
    : [];

  let best = null;

  for (const profile of profiles) {
    let score = 0;

    for (const tag of profile.semanticTags || []) {
      if (tags.includes(tag)) score += 3;
    }

    score += countMatches(text, profile.titleHints || []);

    if (!best || score > best.score) {
      best = {
        profileKey: profile.key,
        family: profile.family,
        score,
        profile,
      };
    }
  }

  if (!best || best.score <= 0) {
    const fallback = profiles.find((x) => x.key === "generic.default");
    return {
      profileKey: fallback?.key || "generic.default",
      family: fallback?.family || "generic",
      score: 0,
      profile: fallback || null,
    };
  }

  return best;
}

export default {
  resolveProfileDraft,
};