// src/core/projectIntent/scope/projectIntentScopeClassifier.js
// ============================================================================
// LEGACY PROJECT INTENT SCOPE MARKER
//
// INTERFACE MODE NOTE:
// - This module is part of the old projectIntent scope classifier.
// - It uses deterministic phrase/token/prefix/path signals.
// - Under hard Human Mode / Technical Mode separation, this is NOT full Human Mode.
// - Treat this as legacy Technical Mode support until a clean structured meaning
//   layer replaces it.
// - Do not add new phrase-bound hacks here.
// ============================================================================

import {
  normalizeText,
  tokenizeText,
  unique,
  countHits,
} from "./projectIntentScopeText.js";
import {
  collectPhraseHits,
  collectTokenHits,
  collectPrefixHits,
} from "./projectIntentScopeSignals.js";
import {
  extractPathLikeObjects,
  looksLikeRepoPath,
} from "./projectIntentScopePath.js";
import {
  SG_CORE_STRONG_ANCHORS,
  SG_CORE_IDENTITY_TOKENS,
  SG_CORE_IDENTITY_PHRASES,
  SG_CANONICAL_PILLAR_PHRASES,
  SG_CANONICAL_PILLAR_TOKENS,
  SG_CORE_OBJECT_PHRASES,
  SG_CORE_OBJECT_TOKENS_STRONG,
  SG_CORE_OBJECT_TOKENS_WEAK,
  SG_CORE_OBJECT_PREFIXES,
  SG_REPO_META_ACCESS_PHRASES,
  SG_REPO_META_ACCESS_TOKENS,
  SG_REPO_META_ACCESS_PREFIXES,
  SG_REPO_TARGET_PREFIXES,
  SG_REPO_STRUCTURE_PHRASES,
  SG_REPO_STRUCTURE_TOKENS,
  SG_REPO_STRUCTURE_PREFIXES,
  USER_PROJECT_PHRASES,
  USER_PROJECT_TOKENS,
  PROJECT_READ_ACTION_PHRASES,
  PROJECT_READ_ACTION_TOKENS,
  PROJECT_WRITE_ACTION_PHRASES,
  PROJECT_WRITE_ACTION_TOKENS,
} from "./projectIntentScopeConstants.js";

function resolveSemanticIntentKind({
  normalized,
  tokens,
  hasReadAction,
  hasWriteAction,
  hasCanonicalPillarSignal,
  hasStrongObject,
  hasWeakObject,
  hasRepoStructureSignal,
  hasRepoPathSignal,
}) {
  const accessMetaPhraseHits = collectPhraseHits(normalized, SG_REPO_META_ACCESS_PHRASES);
  const accessMetaTokenHits = collectTokenHits(tokens, SG_REPO_META_ACCESS_TOKENS);
  const accessMetaPrefixHits = collectPrefixHits(tokens, SG_REPO_META_ACCESS_PREFIXES);
  const repoTargetPrefixHits = collectPrefixHits(tokens, SG_REPO_TARGET_PREFIXES);

  const hasAccessMetaSignal =
    accessMetaPhraseHits.length >= 1 ||
    (
      (accessMetaTokenHits.length >= 1 || accessMetaPrefixHits.length >= 1) &&
      (repoTargetPrefixHits.length >= 1 || hasStrongObject || hasWeakObject || hasCanonicalPillarSignal || hasRepoPathSignal)
    );

  let semanticIntentKind = "unknown";
  const semanticBasis = [];

  if (hasAccessMetaSignal) {
    semanticIntentKind = "repo_access_meta";
    semanticBasis.push("repo_access_meta");
  } else if (hasRepoStructureSignal) {
    semanticIntentKind = "repo_structure_read";
    semanticBasis.push("repo_structure_read");
  } else if (hasCanonicalPillarSignal && hasWriteAction) {
    semanticIntentKind = "canonical_pillar_write";
    semanticBasis.push("canonical_pillar_write");
  } else if (hasCanonicalPillarSignal && hasReadAction) {
    semanticIntentKind = "canonical_pillar_read";
    semanticBasis.push("canonical_pillar_read");
  } else if (hasCanonicalPillarSignal) {
    semanticIntentKind = "canonical_pillar_reference";
    semanticBasis.push("canonical_pillar_reference");
  } else if (hasRepoPathSignal && hasWriteAction) {
    semanticIntentKind = "repo_path_write";
    semanticBasis.push("repo_path_write");
  } else if (hasRepoPathSignal && hasReadAction) {
    semanticIntentKind = "repo_path_read";
    semanticBasis.push("repo_path_read");
  } else if ((hasStrongObject || hasWeakObject) && hasWriteAction) {
    semanticIntentKind = "internal_repo_write";
    semanticBasis.push("internal_repo_write");
  } else if ((hasStrongObject || hasWeakObject) && hasReadAction) {
    semanticIntentKind = "internal_repo_read";
    semanticBasis.push("internal_repo_read");
  }

  return {
    semanticIntentKind,
    semanticBasis,
    accessMetaPhraseHits,
    accessMetaTokenHits,
    accessMetaPrefixHits,
    repoTargetPrefixHits,
    hasAccessMetaSignal,
  };
}

export function collectProjectIntentSignals(text) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);
  const pathLikeObjects = extractPathLikeObjects(text);

  const sgCoreStrongAnchorHits = collectPhraseHits(normalized, SG_CORE_STRONG_ANCHORS);
  const sgCoreIdentityPhraseHits = collectPhraseHits(normalized, SG_CORE_IDENTITY_PHRASES);
  const sgCoreIdentityTokenHits = collectTokenHits(tokens, SG_CORE_IDENTITY_TOKENS);
  const sgCoreObjectPhraseHits = collectPhraseHits(normalized, SG_CORE_OBJECT_PHRASES);
  const sgCoreObjectTokenStrongHits = collectTokenHits(tokens, SG_CORE_OBJECT_TOKENS_STRONG);
  const sgCoreObjectTokenWeakHits = collectTokenHits(tokens, SG_CORE_OBJECT_TOKENS_WEAK);
  const sgCoreObjectPrefixHits = collectPrefixHits(tokens, SG_CORE_OBJECT_PREFIXES);

  const canonicalPillarPhraseHits = collectPhraseHits(normalized, SG_CANONICAL_PILLAR_PHRASES);
  const canonicalPillarTokenHits = collectTokenHits(tokens, SG_CANONICAL_PILLAR_TOKENS);

  const repoStructurePhraseHits = collectPhraseHits(normalized, SG_REPO_STRUCTURE_PHRASES);
  const repoStructureTokenHits = collectTokenHits(tokens, SG_REPO_STRUCTURE_TOKENS);
  const repoStructurePrefixHits = collectPrefixHits(tokens, SG_REPO_STRUCTURE_PREFIXES);

  const userProjectPhraseHits = collectPhraseHits(normalized, USER_PROJECT_PHRASES);
  const userProjectTokenHits = collectTokenHits(tokens, USER_PROJECT_TOKENS);

  const readActionPhraseHits = collectPhraseHits(normalized, PROJECT_READ_ACTION_PHRASES);
  const readActionTokenHits = collectTokenHits(tokens, PROJECT_READ_ACTION_TOKENS);

  const writeActionPhraseHits = collectPhraseHits(normalized, PROJECT_WRITE_ACTION_PHRASES);
  const writeActionTokenHits = collectTokenHits(tokens, PROJECT_WRITE_ACTION_TOKENS);

  const repoPathHits = pathLikeObjects.filter((v) => looksLikeRepoPath(v));

  const readHits = unique([
    ...readActionPhraseHits,
    ...readActionTokenHits,
  ]);

  const writeHits = unique([
    ...writeActionPhraseHits,
    ...writeActionTokenHits,
  ]);

  const sgCoreObjectHits = unique([
    ...sgCoreObjectPhraseHits,
    ...sgCoreObjectTokenStrongHits,
    ...sgCoreObjectTokenWeakHits,
    ...sgCoreObjectPrefixHits,
    ...repoPathHits,
  ]);

  const canonicalPillarHits = unique([
    ...canonicalPillarPhraseHits,
    ...canonicalPillarTokenHits,
  ]);

  const repoStructureHits = unique([
    ...repoStructurePhraseHits,
    ...repoStructureTokenHits,
    ...repoStructurePrefixHits,
  ]);

  const userProjectHits = unique([
    ...userProjectPhraseHits,
    ...userProjectTokenHits,
  ]);

  const anchorHits = unique([
    ...sgCoreStrongAnchorHits,
    ...sgCoreIdentityPhraseHits,
    ...sgCoreObjectPhraseHits,
    ...canonicalPillarPhraseHits,
    ...repoPathHits,
  ]);

  const internalActionHits = unique([
    ...sgCoreObjectHits,
    ...canonicalPillarHits,
    ...repoStructureHits,
    ...readHits,
  ]);

  const writeActionHits = unique(writeHits);

  return {
    normalized,
    tokens,
    pathLikeObjects,
    repoPathHits,

    sgCoreStrongAnchorHits,
    sgCoreIdentityPhraseHits,
    sgCoreIdentityTokenHits,
    sgCoreObjectPhraseHits,
    sgCoreObjectTokenStrongHits,
    sgCoreObjectTokenWeakHits,
    sgCoreObjectPrefixHits,

    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,

    repoStructurePhraseHits,
    repoStructureTokenHits,
    repoStructurePrefixHits,

    userProjectPhraseHits,
    userProjectTokenHits,

    readActionPhraseHits,
    readActionTokenHits,
    writeActionPhraseHits,
    writeActionTokenHits,

    sgCoreObjectHits,
    canonicalPillarHits,
    repoStructureHits,
    userProjectHits,
    readHits,
    writeHits,

    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export function resolveProjectIntentMatch(text) {
  const signals = collectProjectIntentSignals(text);

  const {
    normalized,
    tokens,
    repoPathHits,

    sgCoreStrongAnchorHits,
    sgCoreIdentityPhraseHits,
    sgCoreIdentityTokenHits,
    sgCoreObjectPhraseHits,
    sgCoreObjectTokenStrongHits,
    sgCoreObjectTokenWeakHits,
    sgCoreObjectPrefixHits,

    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,

    repoStructurePhraseHits,
    repoStructureTokenHits,
    repoStructurePrefixHits,

    userProjectPhraseHits,
    userProjectTokenHits,

    readHits,
    writeHits,

    anchorHits,
    internalActionHits,
    writeActionHits,
  } = signals;

  if (!normalized) {
    return {
      ...signals,
      targetScope: "unknown",
      targetDomain: "unknown",
      actionMode: "unknown",
      isProjectInternal: false,
      isProjectWriteIntent: false,
      confidence: "none",
      classificationBasis: [],
      semanticIntentKind: "unknown",
      semanticBasis: [],
      accessMetaPhraseHits: [],
      accessMetaTokenHits: [],
      accessMetaPrefixHits: [],
      repoTargetPrefixHits: [],
      hasAccessMetaSignal: false,
      hasRepoPathSignal: false,
    };
  }

  const hasStrongAnchor = sgCoreStrongAnchorHits.length >= 1;
  const hasIdentityPhrase = sgCoreIdentityPhraseHits.length >= 1;
  const hasIdentityToken = sgCoreIdentityTokenHits.length >= 1;

  const strongObjectHits = unique([
    ...sgCoreObjectPhraseHits,
    ...sgCoreObjectTokenStrongHits,
    ...sgCoreObjectPrefixHits,
    ...repoPathHits,
  ]);

  const weakObjectHits = unique([
    ...sgCoreObjectTokenWeakHits,
  ]);

  const hasStrongObject = strongObjectHits.length >= 1;
  const weakObjectCount = weakObjectHits.length;
  const hasWeakObject = weakObjectCount >= 1;

  const canonicalPillarHits = unique([
    ...canonicalPillarPhraseHits,
    ...canonicalPillarTokenHits,
  ]);
  const hasCanonicalPillarSignal = canonicalPillarHits.length >= 1;

  const repoStructureHits = unique([
    ...repoStructurePhraseHits,
    ...repoStructureTokenHits,
    ...repoStructurePrefixHits,
  ]);
  const hasRepoStructureSignal = repoStructureHits.length >= 1;

  const hasRepoPathSignal = repoPathHits.length >= 1;

  const hasUserProjectPhrase = userProjectPhraseHits.length >= 1;
  const hasUserProjectToken = userProjectTokenHits.length >= 1;

  const hasReadAction = readHits.length >= 1;
  const hasWriteAction = writeHits.length >= 1;

  const {
    semanticIntentKind,
    semanticBasis,
    accessMetaPhraseHits,
    accessMetaTokenHits,
    accessMetaPrefixHits,
    repoTargetPrefixHits,
    hasAccessMetaSignal,
  } = resolveSemanticIntentKind({
    normalized,
    tokens,
    hasReadAction,
    hasWriteAction,
    hasCanonicalPillarSignal,
    hasStrongObject,
    hasWeakObject,
    hasRepoStructureSignal,
    hasRepoPathSignal,
  });

  const classificationBasis = [];
  let targetScope = "unknown";

  // --------------------------------------------------------------------------
  // 1) SG CORE INTERNAL
  // --------------------------------------------------------------------------
  if (hasStrongAnchor) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_anchor");
  } else if (hasAccessMetaSignal && (repoTargetPrefixHits.length >= 1 || hasStrongObject || hasCanonicalPillarSignal || hasIdentityToken || hasRepoPathSignal)) {
    targetScope = "sg_core_internal";
    classificationBasis.push("repo_access_meta_internal");
  } else if (hasRepoStructureSignal && (repoTargetPrefixHits.length >= 1 || hasCanonicalPillarSignal || hasIdentityToken || hasWeakObject || hasRepoPathSignal)) {
    targetScope = "sg_core_internal";
    classificationBasis.push("repo_structure_internal");
  } else if (hasCanonicalPillarSignal && (hasReadAction || hasWriteAction || semanticIntentKind !== "unknown")) {
    targetScope = "sg_core_internal";
    classificationBasis.push("canonical_pillar_internal");
  } else if (hasIdentityPhrase && (hasReadAction || hasWriteAction || hasStrongObject || hasWeakObject || hasRepoPathSignal)) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_phrase");
  } else if (hasIdentityToken && hasWriteAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_token_plus_write");
  } else if (hasIdentityToken && (hasStrongObject || hasRepoPathSignal)) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_token_plus_strong_object");
  } else if (hasRepoPathSignal && hasReadAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("repo_path_plus_read");
  } else if (hasRepoPathSignal && hasWriteAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("repo_path_plus_write");
  } else if (hasStrongObject && hasWriteAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_object_plus_write");
  } else if (hasStrongObject && hasReadAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_object_plus_read");
  } else if (countHits(accessMetaPrefixHits, repoTargetPrefixHits) >= 2 && hasIdentityToken) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_prefix_meta_read");
  }

  // --------------------------------------------------------------------------
  // 2) USER PROJECT
  // --------------------------------------------------------------------------
  if (targetScope === "unknown") {
    if (hasUserProjectPhrase) {
      targetScope = "user_project";
      classificationBasis.push("user_project_phrase");
    } else if (hasUserProjectToken && (hasReadAction || hasWriteAction || hasStrongObject || hasWeakObject)) {
      targetScope = "user_project";
      classificationBasis.push("user_project_token_plus_action_or_object");
    } else if (hasWriteAction && hasWeakObject) {
      targetScope = "user_project";
      classificationBasis.push("generic_project_write");
    } else if (hasReadAction && weakObjectCount >= 2) {
      targetScope = "user_project";
      classificationBasis.push("generic_project_read_with_multiple_objects");
    }
  }

  // --------------------------------------------------------------------------
  // 3) GENERIC EXTERNAL
  // --------------------------------------------------------------------------
  if (targetScope === "unknown") {
    if (hasReadAction || hasWriteAction || hasStrongObject || hasWeakObject || hasRepoStructureSignal || hasRepoPathSignal) {
      targetScope = "generic_external";
      classificationBasis.push("generic_project_like_request");
    }
  }

  let actionMode = "unknown";
  if (hasReadAction && hasWriteAction) {
    actionMode = "mixed";
  } else if (hasWriteAction) {
    actionMode = "write";
  } else if (hasReadAction || hasAccessMetaSignal || hasCanonicalPillarSignal || hasRepoStructureSignal || hasRepoPathSignal) {
    actionMode = "read";
  }

  const isProjectInternal = targetScope === "sg_core_internal";
  const isProjectWriteIntent =
    targetScope === "sg_core_internal" &&
    (actionMode === "write" || actionMode === "mixed");

  let confidence = "low";

  if (targetScope === "unknown") {
    confidence = "none";
  } else if (targetScope === "sg_core_internal") {
    if (hasStrongAnchor) confidence = "high";
    else if (hasRepoPathSignal && hasReadAction) confidence = "high";
    else if (hasRepoPathSignal && hasWriteAction) confidence = "high";
    else if (hasAccessMetaSignal && repoTargetPrefixHits.length >= 1) confidence = "high";
    else if (hasRepoStructureSignal && repoTargetPrefixHits.length >= 1) confidence = "high";
    else if (hasCanonicalPillarSignal && hasReadAction) confidence = "high";
    else if (hasIdentityPhrase) confidence = "high";
    else if (hasIdentityToken && (hasWriteAction || hasStrongObject || hasRepoPathSignal)) confidence = "high";
    else if (hasStrongObject && (hasReadAction || hasWriteAction)) confidence = "medium";
    else confidence = "medium";
  } else if (targetScope === "user_project") {
    if (hasUserProjectPhrase) confidence = "high";
    else if (hasUserProjectToken && (hasReadAction || hasWriteAction)) confidence = "medium";
    else confidence = "medium";
  } else if (targetScope === "generic_external") {
    confidence = "low";
  }

  const targetDomain =
    targetScope === "sg_core_internal"
      ? "sg_internal_project"
      : targetScope === "user_project"
        ? "user_project"
        : targetScope === "generic_external"
          ? "generic_external"
          : "unknown";

  return {
    ...signals,
    targetScope,
    targetDomain,
    actionMode,
    isProjectInternal,
    isProjectWriteIntent,
    confidence,
    classificationBasis: unique([...classificationBasis, ...semanticBasis]),
    strongObjectHits,
    weakObjectHits,
    canonicalPillarHits,
    repoStructureHits,
    objectHits: unique([...strongObjectHits, ...weakObjectHits, ...canonicalPillarHits, ...repoStructureHits]),
    readHits,
    writeHits,
    anchorHits,
    internalActionHits,
    writeActionHits,

    semanticIntentKind,
    semanticBasis,
    accessMetaPhraseHits,
    accessMetaTokenHits,
    accessMetaPrefixHits,
    repoTargetPrefixHits,
    hasAccessMetaSignal,
    hasRepoStructureSignal,
    hasRepoPathSignal,
  };
}

export default {
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};
