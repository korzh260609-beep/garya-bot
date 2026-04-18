// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// STAGE 12A.0 — project free-text intent scope (SKELETON, classifier v3)
// Purpose:
// - classify free-text requests by TARGET SCOPE first, not just by keywords
// - separate SG core internal project from future user-owned projects
// - distinguish action mode: read / write / mixed / unknown
// IMPORTANT:
// - NO command execution here
// - NO repo writes here
// - classification only
// ============================================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>/\\|"'`~@#$%^&*+=-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function collectPhraseHits(normalized, markers) {
  if (!normalized) return [];
  return unique(markers.filter((marker) => normalized.includes(marker)));
}

function collectTokenHits(tokens, markers) {
  if (!tokens.length) return [];
  const tokenSet = new Set(tokens);
  return unique(markers.filter((marker) => tokenSet.has(marker)));
}

function collectPrefixHits(tokens, prefixes) {
  if (!tokens.length) return [];
  const hits = [];

  for (const token of tokens) {
    for (const prefix of prefixes) {
      if (token.startsWith(prefix)) {
        hits.push(token);
        break;
      }
    }
  }

  return unique(hits);
}

// ----------------------------------------------------------------------------
// SG CORE — STRONG INTERNAL SIGNALS
// ----------------------------------------------------------------------------

export const SG_CORE_STRONG_ANCHORS = Object.freeze([
  "garya-bot",
  "советник garya",
  "sg core",
  "core sg",
  "core project sg",
  "проект sg",
  "sg project",
  "мой проект sg",
  "my sg project",
  "мой репозиторий sg",
  "my sg repo",
  "workflow.md",
  "roadmap.md",
  "decisions.md",
  "pillars/",
  "/workflow_check",
  "/stage_check",
  "workflow_check",
  "stage_check",
  "repo_status",
  "repo_tree",
  "repo_file",
  "repo_search",
  "repo_get",
  "repo_analyze",
  "repo_check",
  "repo_review",
  "repo_review2",
  "code_output_status",
]);

export const SG_CORE_IDENTITY_TOKENS = Object.freeze([
  "sg",
  "сг",
]);

export const SG_CORE_IDENTITY_PHRASES = Object.freeze([
  "project sg",
  "sg project",
  "проект sg",
  "sg repo",
  "repo sg",
  "репо sg",
]);

export const SG_CORE_OBJECT_PHRASES = Object.freeze([
  "workflow sg",
  "roadmap sg",
  "architecture sg",
  "sg architecture",
  "core architecture",
  "архитектура sg",
  "архитектура советника garya",
  "код sg",
  "repo sg",
  "github sg",
]);

export const SG_CORE_OBJECT_TOKENS_STRONG = Object.freeze([
  "workflow",
  "roadmap",
  "architecture",
  "github",
  "repository",
  "repo",
  "pillars",
  "decisions",
]);

export const SG_CORE_OBJECT_TOKENS_WEAK = Object.freeze([
  "project",
  "projects",
  "code",
  "проект",
  "проекта",
  "проекту",
  "код",
  "репо",
  "репозиторий",
  "архитектура",
  "воркфлоу",
]);

export const SG_CORE_OBJECT_PREFIXES = Object.freeze([
  "репозитор",
  "архитектур",
]);

// ----------------------------------------------------------------------------
// USER PROJECT SIGNALS
// ----------------------------------------------------------------------------

export const USER_PROJECT_PHRASES = Object.freeze([
  "my project",
  "мой проект",
  "мой бот",
  "my bot",
  "my repo",
  "мой репозиторий",
  "мой github",
  "my github",
  "мой код",
  "my code",
  "мой сервис",
  "my service",
]);

export const USER_PROJECT_TOKENS = Object.freeze([
  "my",
  "мой",
  "моя",
  "моё",
  "мои",
]);

// ----------------------------------------------------------------------------
// ACTIONS
// ----------------------------------------------------------------------------

export const PROJECT_READ_ACTION_PHRASES = Object.freeze([
  "check repo",
  "check my repo",
  "look into my repo",
  "analyze my repo",
  "check workflow",
  "check stage",
  "проверь код",
  "проверь репо",
  "проверь репозиторий",
  "посмотри репо",
  "посмотри репозиторий",
  "проверь workflow",
  "проверь архитектуру",
]);

export const PROJECT_READ_ACTION_TOKENS = Object.freeze([
  "check",
  "analyze",
  "inspect",
  "review",
  "read",
  "show",
  "look",
  "compare",
  "verify",
  "scan",
  "find",
  "open",
  "посмотри",
  "проверь",
  "проверить",
  "проверка",
  "показать",
  "открой",
  "сравни",
  "сравнить",
  "найди",
  "прочитай",
  "анализ",
  "проанализируй",
]);

export const PROJECT_WRITE_ACTION_PHRASES = Object.freeze([
  "open pr",
  "create pr",
  "pull request",
  "write to repo",
  "edit repo",
  "modify repo",
  "change repo",
  "rewrite file",
  "replace file",
  "delete file",
  "remove file",
  "update file",
  "create file",
  "apply patch",
  "apply diff",
  "auto deploy",
  "сделай коммит",
  "создай pr",
  "создай пулл реквест",
  "измени файл",
  "измени код",
  "запиши в репо",
  "удали файл",
  "перепиши файл",
  "обнови файл",
  "сделай деплой",
]);

export const PROJECT_WRITE_ACTION_TOKENS = Object.freeze([
  "commit",
  "push",
  "merge",
  "deploy",
  "release",
  "edit",
  "modify",
  "change",
  "rewrite",
  "replace",
  "delete",
  "remove",
  "update",
  "create",
  "write",
  "apply",
  "patch",
  "diff",
  "pr",
  "закоммить",
  "запушь",
  "смёрджи",
  "смерджи",
  "задеплой",
  "деплой",
  "обнови",
  "измени",
  "удали",
  "создай",
  "запиши",
  "перепиши",
]);

export function collectProjectIntentSignals(text) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const sgCoreStrongAnchorHits = collectPhraseHits(normalized, SG_CORE_STRONG_ANCHORS);
  const sgCoreIdentityPhraseHits = collectPhraseHits(normalized, SG_CORE_IDENTITY_PHRASES);
  const sgCoreIdentityTokenHits = collectTokenHits(tokens, SG_CORE_IDENTITY_TOKENS);
  const sgCoreObjectPhraseHits = collectPhraseHits(normalized, SG_CORE_OBJECT_PHRASES);
  const sgCoreObjectTokenStrongHits = collectTokenHits(tokens, SG_CORE_OBJECT_TOKENS_STRONG);
  const sgCoreObjectTokenWeakHits = collectTokenHits(tokens, SG_CORE_OBJECT_TOKENS_WEAK);
  const sgCoreObjectPrefixHits = collectPrefixHits(tokens, SG_CORE_OBJECT_PREFIXES);

  const userProjectPhraseHits = collectPhraseHits(normalized, USER_PROJECT_PHRASES);
  const userProjectTokenHits = collectTokenHits(tokens, USER_PROJECT_TOKENS);

  const readActionPhraseHits = collectPhraseHits(normalized, PROJECT_READ_ACTION_PHRASES);
  const readActionTokenHits = collectTokenHits(tokens, PROJECT_READ_ACTION_TOKENS);

  const writeActionPhraseHits = collectPhraseHits(normalized, PROJECT_WRITE_ACTION_PHRASES);
  const writeActionTokenHits = collectTokenHits(tokens, PROJECT_WRITE_ACTION_TOKENS);

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
  ]);

  const userProjectHits = unique([
    ...userProjectPhraseHits,
    ...userProjectTokenHits,
  ]);

  const anchorHits = unique([
    ...sgCoreStrongAnchorHits,
    ...sgCoreIdentityPhraseHits,
    ...sgCoreObjectPhraseHits,
  ]);

  const internalActionHits = unique([
    ...sgCoreObjectHits,
    ...readHits,
  ]);

  const writeActionHits = unique(writeHits);

  return {
    normalized,
    tokens,

    sgCoreStrongAnchorHits,
    sgCoreIdentityPhraseHits,
    sgCoreIdentityTokenHits,
    sgCoreObjectPhraseHits,
    sgCoreObjectTokenStrongHits,
    sgCoreObjectTokenWeakHits,
    sgCoreObjectPrefixHits,

    userProjectPhraseHits,
    userProjectTokenHits,

    readActionPhraseHits,
    readActionTokenHits,
    writeActionPhraseHits,
    writeActionTokenHits,

    sgCoreObjectHits,
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

    sgCoreStrongAnchorHits,
    sgCoreIdentityPhraseHits,
    sgCoreIdentityTokenHits,
    sgCoreObjectPhraseHits,
    sgCoreObjectTokenStrongHits,
    sgCoreObjectTokenWeakHits,
    sgCoreObjectPrefixHits,

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
    };
  }

  const hasStrongAnchor = sgCoreStrongAnchorHits.length >= 1;
  const hasIdentityPhrase = sgCoreIdentityPhraseHits.length >= 1;
  const hasIdentityToken = sgCoreIdentityTokenHits.length >= 1;

  const strongObjectHits = unique([
    ...sgCoreObjectPhraseHits,
    ...sgCoreObjectTokenStrongHits,
    ...sgCoreObjectPrefixHits,
  ]);

  const weakObjectHits = unique([
    ...sgCoreObjectTokenWeakHits,
  ]);

  const hasStrongObject = strongObjectHits.length >= 1;
  const weakObjectCount = weakObjectHits.length;
  const hasWeakObject = weakObjectCount >= 1;

  const hasUserProjectPhrase = userProjectPhraseHits.length >= 1;
  const hasUserProjectToken = userProjectTokenHits.length >= 1;

  const hasReadAction = readHits.length >= 1;
  const hasWriteAction = writeHits.length >= 1;

  const classificationBasis = [];
  let targetScope = "unknown";

  // --------------------------------------------------------------------------
  // 1) SG CORE INTERNAL
  // --------------------------------------------------------------------------
  if (hasStrongAnchor) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_anchor");
  } else if (hasIdentityPhrase && (hasReadAction || hasWriteAction || hasStrongObject || hasWeakObject)) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_phrase");
  } else if (hasIdentityToken && hasWriteAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_token_plus_write");
  } else if (hasIdentityToken && hasStrongObject) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_identity_token_plus_strong_object");
  } else if (hasStrongObject && hasWriteAction) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_object_plus_write");
  } else if (hasStrongObject && hasReadAction && hasIdentityToken) {
    targetScope = "sg_core_internal";
    classificationBasis.push("sg_core_strong_object_plus_read_plus_identity");
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
    if (hasReadAction || hasWriteAction || hasStrongObject || hasWeakObject) {
      targetScope = "generic_external";
      classificationBasis.push("generic_project_like_request");
    }
  }

  let actionMode = "unknown";
  if (hasReadAction && hasWriteAction) {
    actionMode = "mixed";
  } else if (hasWriteAction) {
    actionMode = "write";
  } else if (hasReadAction) {
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
    else if (hasIdentityPhrase) confidence = "high";
    else if (hasIdentityToken && (hasWriteAction || hasStrongObject)) confidence = "high";
    else if (hasStrongObject && hasWriteAction) confidence = "medium";
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
    classificationBasis: unique(classificationBasis),
    strongObjectHits,
    weakObjectHits,
    objectHits: unique([...strongObjectHits, ...weakObjectHits]),
    readHits,
    writeHits,
    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export default {
  SG_CORE_STRONG_ANCHORS,
  SG_CORE_IDENTITY_TOKENS,
  SG_CORE_IDENTITY_PHRASES,
  SG_CORE_OBJECT_PHRASES,
  SG_CORE_OBJECT_TOKENS_STRONG,
  SG_CORE_OBJECT_TOKENS_WEAK,
  SG_CORE_OBJECT_PREFIXES,
  USER_PROJECT_PHRASES,
  USER_PROJECT_TOKENS,
  PROJECT_READ_ACTION_PHRASES,
  PROJECT_READ_ACTION_TOKENS,
  PROJECT_WRITE_ACTION_PHRASES,
  PROJECT_WRITE_ACTION_TOKENS,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};