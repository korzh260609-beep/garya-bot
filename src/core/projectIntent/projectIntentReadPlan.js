// src/core/projectIntent/projectIntentReadPlan.js
// ============================================================================
// STAGE 12A.0 — project read-plan resolver (semantic-first)
// Purpose:
// - understand live human intent before mapping to system actions
// - keep repo follow-up continuity
// - do NOT over-bind natural language to raw commands
// IMPORTANT:
// - planning only
// - NO command execution
// - NO repo writes
// ============================================================================

import {
  normalizeText,
  tokenizeText,
  unique,
  pickFirstNonEmpty,
} from "./readPlan/projectIntentReadPlanText.js";
import {
  collectPhraseHits,
  collectTokenHits,
} from "./readPlan/projectIntentReadPlanSignals.js";
import {
  PILLARS_ROOT_PHRASES,
  PILLARS_ROOT_TOKENS,
  STATUS_PHRASES,
  TREE_PHRASES,
  DIFF_PHRASES,
} from "./readPlan/projectIntentReadPlanConstants.js";
import {
  extractPathHints,
  resolvePillarFileMatch,
  resolveSemanticTarget,
} from "./readPlan/projectIntentReadPlanTargets.js";
import {
  looksLikeRepoAccessMetaIntent,
  resolveDisplayMode,
  resolveIntentType,
  resolvePlanKey,
  resolveRecommendedCommand,
} from "./readPlan/projectIntentReadPlanIntent.js";
import {
  resolvePlanPreview,
  resolveNeedsClarification,
  resolveConfidence,
  resolveAnalyzeQuestion,
} from "./readPlan/projectIntentReadPlanOutput.js";

export function resolveProjectIntentReadPlan({
  text,
  route = null,
  followupContext = null,
} = {}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const statusPhraseHits = collectPhraseHits(normalized, STATUS_PHRASES);
  const treePhraseHits = collectPhraseHits(normalized, TREE_PHRASES);
  const diffPhraseHits = collectPhraseHits(normalized, DIFF_PHRASES);

  const pillarsRootPhraseHits = collectPhraseHits(normalized, PILLARS_ROOT_PHRASES);
  const pillarsRootTokenHits = collectTokenHits(tokens, PILLARS_ROOT_TOKENS);

  const {
    canonicalPillarPath,
    canonicalPillarBasis,
    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,
    canonicalPillarEntity,
  } = resolvePillarFileMatch(normalized);

  const {
    phraseHits: repoAccessMetaPhraseHits,
    tokenHits: repoAccessMetaTokenHits,
    prefixHits: repoAccessMetaPrefixHits,
    repoTargetHits,
    hasRepoAccessMetaSignal,
  } = looksLikeRepoAccessMetaIntent(normalized, tokens);

  const pathHints = extractPathHints(text);

  const hasPillarsRootSignal =
    pillarsRootPhraseHits.length >= 1 || pillarsRootTokenHits.length >= 1;

  const hasStatusSignal = statusPhraseHits.length > 0;
  const hasTreeSignal = treePhraseHits.length > 0;
  const hasDiffSignal = diffPhraseHits.length > 0;

  const semanticTarget = resolveSemanticTarget({
    normalized,
    pathHints,
    hasPillarsRootSignal,
    canonicalPillarPath,
    canonicalPillarEntity,
    followupContext,
  });

  const intentType = resolveIntentType({
    normalized,
    tokens,
    hasRepoAccessMetaSignal,
    hasStatusSignal,
    hasTreeSignal,
    hasDiffSignal,
    targetKind: semanticTarget.targetKind,
    targetEntity: semanticTarget.targetEntity,
    followupContext,
  });

  const planKey = resolvePlanKey({
    intentType,
    targetPath: semanticTarget.targetPath,
    targetEntity: semanticTarget.targetEntity,
  });

  const recommendedCommand = resolveRecommendedCommand(planKey);
  const displayMode = resolveDisplayMode(tokens, normalized);

  const clarification = resolveNeedsClarification({
    planKey,
    targetEntity: semanticTarget.targetEntity,
    targetPath: semanticTarget.targetPath,
  });

  const confidence = resolveConfidence({
    hasRepoAccessMetaSignal,
    targetKind: semanticTarget.targetKind,
    targetPath: semanticTarget.targetPath,
    targetEntity: semanticTarget.targetEntity,
    intentType,
    needsClarification: clarification.needsClarification,
    followupContext,
  });

  const analyzeQuestion = resolveAnalyzeQuestion({
    text,
    planKey,
  });

  const basis = unique([
    ...semanticTarget.targetBasis,
    canonicalPillarBasis,
    followupContext?.isActive ? "followup_context_active" : "",
    hasRepoAccessMetaSignal ? "repo_access_meta" : "",
    hasStatusSignal ? "status_signal" : "",
    hasTreeSignal ? "tree_signal" : "",
    hasDiffSignal ? "diff_signal" : "",
    intentType ? `intent:${intentType}` : "",
    displayMode ? `display:${displayMode}` : "",
  ]);

  const searchEntityHints = unique([
    semanticTarget.targetEntity,
    semanticTarget.targetPath,
    canonicalPillarPath,
    hasPillarsRootSignal ? "pillars/" : "",
    followupContext?.targetEntity || "",
    followupContext?.targetPath || "",
  ]);

  const routeKey = String(route?.routeKey || "").trim();
  const routeAllowsInternalRead =
    routeKey === "sg_core_internal_read_allowed";

  return {
    normalized,
    tokens,

    statusPhraseHits,
    treePhraseHits,
    diffPhraseHits,

    pillarsRootPhraseHits,
    pillarsRootTokenHits,
    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,

    repoAccessMetaPhraseHits,
    repoAccessMetaTokenHits,
    repoAccessMetaPrefixHits,
    repoTargetHits,
    hasRepoAccessMetaSignal,

    canonicalPillarPath,
    canonicalPillarBasis,
    canonicalPillarEntity,
    hasPillarsRootSignal,

    pathHints,
    primaryPathHint: pickFirstNonEmpty(pathHints) || pickFirstNonEmpty([canonicalPillarPath]),
    searchEntityHints,

    intentType,
    targetKind: semanticTarget.targetKind,
    targetEntity: semanticTarget.targetEntity,
    targetPath: semanticTarget.targetPath,
    displayMode,
    analyzeQuestion,
    needsClarification: clarification.needsClarification,
    clarificationQuestion: clarification.clarificationQuestion,

    followupContextActive: followupContext?.isActive === true,
    followupSourceHandler: String(followupContext?.handlerKey || "").trim(),

    planKey,
    recommendedCommand,
    confidence,
    basis,

    routeKey,
    routeAllowsInternalRead,

    preview: resolvePlanPreview({ planKey }),
  };
}

export default {
  resolveProjectIntentReadPlan,
};