// ============================================================================
// === src/core/stageCheck/real/realNodeProfileResolver.js
// === resolves universal real-evidence profile for workflow subtree
// ============================================================================

import { getAllRealProfiles } from "./realProfileRegistry.js";

function normalizeScopeItems(scopeWorkflowItems = []) {
  return Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
}

function buildScopeText(scopeWorkflowItems = []) {
  return normalizeScopeItems(scopeWorkflowItems)
    .map((item) => `${item?.code || ""} ${item?.title || ""}`.trim())
    .join(" ")
    .toLowerCase();
}

function countHits(text, tokens = []) {
  let score = 0;

  for (const token of tokens) {
    const normalized = String(token || "").trim().toLowerCase();
    if (!normalized) continue;
    if (text.includes(normalized)) score += 1;
  }

  return score;
}

export function resolveRealNodeProfile({
  scopeWorkflowItems,
  scopeSemanticProfile,
} = {}) {
  const items = normalizeScopeItems(scopeWorkflowItems);
  const text = buildScopeText(items);
  const tags = Array.isArray(scopeSemanticProfile?.tags)
    ? scopeSemanticProfile.tags
    : [];

  const profiles = getAllRealProfiles();

  let best = null;

  for (const profile of profiles) {
    const profileTags = Array.isArray(profile?.semantic?.tags)
      ? profile.semantic.tags
      : [];
    const profileTokens = Array.isArray(profile?.semantic?.implementationTokens)
      ? profile.semantic.implementationTokens
      : [];

    let score = 0;

    for (const tag of profileTags) {
      if (tags.includes(tag)) score += 3;
    }

    score += countHits(text, profileTokens);

    if (!best || score > best.score) {
      best = {
        profileKey: profile.key,
        score,
        profile,
      };
    }
  }

  const fallback = best?.score > 0 ? best : {
    profileKey: "feature.generic",
    score: 0,
    profile: profiles.find((x) => x.key === "feature.generic"),
  };

  return {
    profileKey: fallback.profileKey,
    profileScore: fallback.score,
    profile: fallback.profile,
  };
}

export default {
  resolveRealNodeProfile,
};