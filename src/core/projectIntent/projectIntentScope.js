// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// STAGE 12A.0 — project free-text intent scope (SKELETON, classifier v2)
// Purpose:
// - classify INTERNAL SG project intent from free text using multi-signal rules
// - distinguish target domain from action mode
// - reduce dependence on exact phrases
// IMPORTANT:
// - NO command execution here
// - NO repo writes here
// - this file only classifies text intent
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

export const PROJECT_INTENT_STRONG_ANCHORS = Object.freeze([
  "garya-bot",
  "советник garya",
  "sg project",
  "проект sg",
  "my sg project",
  "мой проект sg",
  "my sg repo",
  "мой репозиторий sg",
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

export const PROJECT_INTENT_IDENTITY_TOKENS = Object.freeze([
  "sg",
  "сг",
  "garya",
  "советник",
]);

export const PROJECT_INTENT_OBJECT_PHRASES = Object.freeze([
  "sg project",
  "проект sg",
  "my project",
  "мой проект",
  "my repo",
  "мой репозиторий",
  "project architecture",
  "архитектура проекта",
  "код проекта",
]);

export const PROJECT_INTENT_OBJECT_TOKENS = Object.freeze([
  "repo",
  "repository",
  "github",
  "workflow",
  "roadmap",
  "pillars",
  "architecture",
  "architectural",
  "stage",
  "stages",
  "code",
  "project",
  "projects",
  "repofile",
  "репозиторий",
  "репо",
  "архитектура",
  "архитектуры",
  "код",
  "проект",
  "проекта",
  "проекту",
  "этап",
  "этапы",
  "воркфлоу",
]);

export const PROJECT_INTENT_OBJECT_PREFIXES = Object.freeze([
  "репозитор",
  "архитектур",
]);

export const PROJECT_INTENT_READ_ACTION_PHRASES = Object.freeze([
  "check repo",
  "check my repo",
  "look into my repo",
  "analyze my repo",
  "analyze sg project",
  "check sg architecture",
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

export const PROJECT_INTENT_READ_ACTION_TOKENS = Object.freeze([
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
  "провести",
  "анализ",
  "проанализируй",
]);

export const PROJECT_INTENT_WRITE_ACTION_PHRASES = Object.freeze([
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

export const PROJECT_INTENT_WRITE_ACTION_TOKENS = Object.freeze([
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

  const strongAnchorHits = collectPhraseHits(
    normalized,
    PROJECT_INTENT_STRONG_ANCHORS
  );

  const identityTokenHits = collectTokenHits(
    tokens,
    PROJECT_INTENT_IDENTITY_TOKENS
  );

  const objectPhraseHits = collectPhraseHits(
    normalized,
    PROJECT_INTENT_OBJECT_PHRASES
  );

  const objectTokenHits = collectTokenHits(
    tokens,
    PROJECT_INTENT_OBJECT_TOKENS
  );

  const objectPrefixHits = collectPrefixHits(
    tokens,
    PROJECT_INTENT_OBJECT_PREFIXES
  );

  const readActionPhraseHits = collectPhraseHits(
    normalized,
    PROJECT_INTENT_READ_ACTION_PHRASES
  );

  const readActionTokenHits = collectTokenHits(
    tokens,
    PROJECT_INTENT_READ_ACTION_TOKENS
  );

  const writeActionPhraseHits = collectPhraseHits(
    normalized,
    PROJECT_INTENT_WRITE_ACTION_PHRASES
  );

  const writeActionTokenHits = collectTokenHits(
    tokens,
    PROJECT_INTENT_WRITE_ACTION_TOKENS
  );

  const anchorHits = unique([
    ...strongAnchorHits,
    ...objectPhraseHits,
  ]);

  const internalActionHits = unique([
    ...objectPhraseHits,
    ...objectTokenHits,
    ...objectPrefixHits,
    ...readActionPhraseHits,
    ...readActionTokenHits,
  ]);

  const writeActionHits = unique([
    ...writeActionPhraseHits,
    ...writeActionTokenHits,
  ]);

  return {
    normalized,
    tokens,

    strongAnchorHits,
    identityTokenHits,

    objectPhraseHits,
    objectTokenHits,
    objectPrefixHits,

    readActionPhraseHits,
    readActionTokenHits,

    writeActionPhraseHits,
    writeActionTokenHits,

    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export function resolveProjectIntentMatch(text) {
  const signals = collectProjectIntentSignals(text);

  const {
    normalized,
    strongAnchorHits,
    identityTokenHits,
    objectPhraseHits,
    objectTokenHits,
    objectPrefixHits,
    readActionPhraseHits,
    readActionTokenHits,
    writeActionPhraseHits,
    writeActionTokenHits,
    anchorHits,
    internalActionHits,
    writeActionHits,
  } = signals;

  if (!normalized) {
    return {
      ...signals,
      targetDomain: "unknown",
      actionMode: "unknown",
      isProjectInternal: false,
      isProjectWriteIntent: false,
      confidence: "none",
      classificationBasis: [],
    };
  }

  const hasStrongAnchor = strongAnchorHits.length >= 1;
  const hasIdentityToken = identityTokenHits.length >= 1;

  const objectHits = unique([
    ...objectPhraseHits,
    ...objectTokenHits,
    ...objectPrefixHits,
  ]);

  const readHits = unique([
    ...readActionPhraseHits,
    ...readActionTokenHits,
  ]);

  const writeHits = unique([
    ...writeActionPhraseHits,
    ...writeActionTokenHits,
  ]);

  const hasProjectObject = objectHits.length >= 1;
  const hasReadAction = readHits.length >= 1;
  const hasWriteAction = writeHits.length >= 1;

  const classificationBasis = [];

  let targetDomain = "unknown";

  if (hasStrongAnchor) {
    targetDomain = "sg_internal_project";
    classificationBasis.push("strong_anchor");
  } else if (hasIdentityToken && (hasProjectObject || hasReadAction || hasWriteAction)) {
    targetDomain = "sg_internal_project";
    classificationBasis.push("identity_plus_action_or_object");
  } else if (hasProjectObject && (hasReadAction || hasWriteAction)) {
    targetDomain = "sg_internal_project";
    classificationBasis.push("project_object_plus_action");
  } else if (objectHits.length >= 2) {
    targetDomain = "sg_internal_project";
    classificationBasis.push("multiple_project_objects");
  }

  let actionMode = "unknown";
  if (hasReadAction && hasWriteAction) {
    actionMode = "mixed";
  } else if (hasWriteAction) {
    actionMode = "write";
  } else if (hasReadAction) {
    actionMode = "read";
  }

  const isProjectInternal = targetDomain === "sg_internal_project";
  const isProjectWriteIntent =
    isProjectInternal && (actionMode === "write" || actionMode === "mixed");

  let confidence = "low";

  if (!isProjectInternal && !hasReadAction && !hasWriteAction && !hasProjectObject) {
    confidence = "none";
  } else if (hasStrongAnchor && hasWriteAction) {
    confidence = "high";
  } else if (hasStrongAnchor) {
    confidence = "high";
  } else if (hasIdentityToken && hasWriteAction) {
    confidence = "high";
  } else if (hasIdentityToken && hasProjectObject) {
    confidence = "high";
  } else if (hasProjectObject && (hasReadAction || hasWriteAction)) {
    confidence = "medium";
  } else if (objectHits.length >= 2) {
    confidence = "medium";
  } else if (hasReadAction || hasWriteAction || hasProjectObject) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  return {
    ...signals,
    targetDomain,
    actionMode,
    isProjectInternal,
    isProjectWriteIntent,
    confidence,
    classificationBasis: unique(classificationBasis),
    objectHits,
    readHits,
    writeHits,
    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export default {
  PROJECT_INTENT_STRONG_ANCHORS,
  PROJECT_INTENT_IDENTITY_TOKENS,
  PROJECT_INTENT_OBJECT_PHRASES,
  PROJECT_INTENT_OBJECT_TOKENS,
  PROJECT_INTENT_OBJECT_PREFIXES,
  PROJECT_INTENT_READ_ACTION_PHRASES,
  PROJECT_INTENT_READ_ACTION_TOKENS,
  PROJECT_INTENT_WRITE_ACTION_PHRASES,
  PROJECT_INTENT_WRITE_ACTION_TOKENS,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};