// src/core/projectIntent/readPlan/projectIntentReadPlanIntent.js

import {
  REPO_ACCESS_META_PHRASES,
  REPO_ACCESS_META_TOKENS,
  REPO_ACCESS_META_PREFIXES,
  REPO_TARGET_PREFIXES,
  SEARCH_PREFIXES,
  READ_PREFIXES,
  EXPLAIN_PREFIXES,
  TRANSLATE_PREFIXES,
  SUMMARY_PREFIXES,
  CHECK_PREFIXES,
} from "./projectIntentReadPlanConstants.js";
import {
  collectPhraseHits,
  collectTokenHits,
  collectPrefixHits,
} from "./projectIntentReadPlanSignals.js";

export function looksLikeRepoAccessMetaIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, REPO_ACCESS_META_PHRASES);
  const tokenHits = collectTokenHits(tokens, REPO_ACCESS_META_TOKENS);
  const prefixHits = collectPrefixHits(tokens, REPO_ACCESS_META_PREFIXES);
  const repoTargetHits = collectPrefixHits(tokens, REPO_TARGET_PREFIXES);

  const hasRepoAccessMetaSignal =
    phraseHits.length > 0 ||
    (prefixHits.length > 0 && repoTargetHits.length > 0) ||
    (tokenHits.length > 0 && repoTargetHits.length > 0);

  return {
    phraseHits,
    tokenHits,
    prefixHits,
    repoTargetHits,
    hasRepoAccessMetaSignal,
  };
}

export function resolveDisplayMode(tokens, normalized) {
  const translateHits = collectPrefixHits(tokens, TRANSLATE_PREFIXES);
  const summaryHits = collectPrefixHits(tokens, SUMMARY_PREFIXES);
  const explainHits = collectPrefixHits(tokens, EXPLAIN_PREFIXES);

  if (normalized.includes("на русском") || normalized.includes("по-русски")) {
    return "translate_ru";
  }

  if (translateHits.length > 0) return "translate";
  if (summaryHits.length > 0) return "summary";
  if (explainHits.length > 0) return "explain";
  return "raw";
}

export function resolveIntentType({
  normalized,
  tokens,
  hasRepoAccessMetaSignal,
  hasStatusSignal,
  hasTreeSignal,
  hasDiffSignal,
  targetKind,
  targetEntity,
  followupContext = null,
}) {
  const searchLike = collectPrefixHits(tokens, SEARCH_PREFIXES).length > 0;
  const readLike = collectPrefixHits(tokens, READ_PREFIXES).length > 0;
  const explainLike = collectPrefixHits(tokens, EXPLAIN_PREFIXES).length > 0;
  const translateLike = collectPrefixHits(tokens, TRANSLATE_PREFIXES).length > 0;
  const summaryLike = collectPrefixHits(tokens, SUMMARY_PREFIXES).length > 0;
  const checkLike = collectPrefixHits(tokens, CHECK_PREFIXES).length > 0;

  if (hasRepoAccessMetaSignal) return "repo_status_check";
  if (hasStatusSignal) return "repo_status_check";
  if (hasTreeSignal) return "browse_tree";
  if (hasDiffSignal) return "compare_diff";

  if (targetEntity === "workflow" && checkLike) return "workflow_check";
  if (targetEntity === "stage" && checkLike) return "stage_check";

  if (followupContext?.isActive && (explainLike || translateLike || summaryLike)) {
    return "explain_target";
  }

  if (searchLike && (explainLike || translateLike || summaryLike)) {
    return "find_and_analyze";
  }

  if (searchLike) return "find_target";
  if (readLike) return "open_target";
  if (explainLike || translateLike || summaryLike) return "explain_target";

  if (targetKind === "canonical_doc" && normalized) {
    return "open_target";
  }

  return "generic_internal_read";
}

export function resolvePlanKey({ intentType, targetPath, targetEntity }) {
  if (intentType === "repo_status_check") return "repo_status";
  if (intentType === "browse_tree") return "repo_tree";
  if (intentType === "compare_diff") return "repo_diff";
  if (intentType === "workflow_check") return "workflow_check";
  if (intentType === "stage_check") return "stage_check";
  if (intentType === "find_target") return "repo_search";
  if (intentType === "find_and_analyze") return "repo_search";
  if (intentType === "open_target") return "repo_file";
  if (intentType === "explain_target") {
    if (targetPath) return "repo_analyze";
    if (targetEntity) return "repo_search";
    return "generic_internal_read";
  }

  if (targetPath) return "repo_file";
  if (targetEntity) return "repo_search";
  return "generic_internal_read";
}

export function resolveRecommendedCommand(planKey) {
  if (planKey === "workflow_check") return "/workflow_check";
  if (planKey === "stage_check") return "/stage_check";
  if (planKey === "repo_status") return "/repo_status";
  if (planKey === "repo_tree") return "/repo_tree";
  if (planKey === "repo_file") return "/repo_file";
  if (planKey === "repo_search") return "/repo_search";
  if (planKey === "repo_analyze") return "/repo_analyze";
  if (planKey === "repo_diff") return "/repo_diff";
  return "/repo_search";
}

export default {
  looksLikeRepoAccessMetaIntent,
  resolveDisplayMode,
  resolveIntentType,
  resolvePlanKey,
  resolveRecommendedCommand,
};