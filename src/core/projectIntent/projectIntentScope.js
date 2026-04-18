// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// STAGE 12A.0 — project free-text intent scope (SKELETON, refined)
// Purpose:
// - detect likely INTERNAL SG project/repo/workflow requests in free text
// - distinguish read-only internal intent vs write-intent
// - reduce false positives on generic words like repo/github/workflow
// IMPORTANT:
// - NO command execution here
// - NO repo writes here
// - scope file only classifies text signals
// ============================================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const PROJECT_INTENT_ANCHORS = Object.freeze([
  "garya-bot",
  "советник garya",
  "проект sg",
  "sg project",
  "мой проект sg",
  "my sg project",
  "мой репозиторий sg",
  "my sg repo",
  "pillars/",
  "workflow.md",
  "roadmap.md",
  "decisions.md",
  "code_output_status",
  "workflow_check",
  "stage_check",
  "/workflow_check",
  "/stage_check",
  "repo_status",
  "repo_tree",
  "repo_file",
  "repo_search",
  "repo_get",
  "repo_analyze",
  "repo_check",
  "repo_review",
  "repo_review2",
]);

export const PROJECT_INTENT_INTERNAL_ACTIONS = Object.freeze([
  "repo",
  "repository",
  "github",
  "workflow",
  "roadmap",
  "pillars",
  "stage check",
  "stage-check",
  "architecture",
  "architectural",
  "архитектура",
  "архитектур",
  "репозитор",
  "код проекта",
  "проверь код",
  "проверь репо",
  "проверь репозиторий",
  "посмотри репо",
  "посмотри репозиторий",
  "check repo",
  "check my repo",
  "look into my repo",
  "analyze my repo",
  "analyze sg project",
  "check sg architecture",
  "check workflow",
  "check stage",
  "проверь workflow",
  "проверь архитектуру",
]);

export const PROJECT_INTENT_WRITE_ACTIONS = Object.freeze([
  "commit",
  "push",
  "merge",
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
  "deploy",
  "auto deploy",
  "release",
  "измени файл",
  "измени код",
  "запиши в репо",
  "закоммить",
  "сделай коммит",
  "запушь",
  "смёрджи",
  "смерджи",
  "создай pr",
  "создай пулл реквест",
  "удали файл",
  "перепиши файл",
  "обнови файл",
  "задеплой",
  "сделай деплой",
]);

function collectHits(normalized, markers) {
  if (!normalized) return [];
  return markers.filter((marker) => normalized.includes(marker));
}

export function collectProjectIntentSignals(text) {
  const normalized = normalizeText(text);

  const anchorHits = collectHits(normalized, PROJECT_INTENT_ANCHORS);
  const internalActionHits = collectHits(normalized, PROJECT_INTENT_INTERNAL_ACTIONS);
  const writeActionHits = collectHits(normalized, PROJECT_INTENT_WRITE_ACTIONS);

  return {
    normalized,
    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export function resolveProjectIntentMatch(text) {
  const { normalized, anchorHits, internalActionHits, writeActionHits } =
    collectProjectIntentSignals(text);

  if (!normalized) {
    return {
      isProjectInternal: false,
      isProjectWriteIntent: false,
      confidence: "none",
      anchorHits,
      internalActionHits,
      writeActionHits,
    };
  }

  const hasAnchor = anchorHits.length >= 1;
  const hasInternalAction = internalActionHits.length >= 1;
  const hasWriteAction = writeActionHits.length >= 1;

  // Internal SG project intent:
  // 1) direct anchor is enough
  // 2) OR >=2 internal action markers (still likely project/repo request)
  const internalByAnchor = hasAnchor;
  const internalByActionCombo = internalActionHits.length >= 2;

  const isProjectInternal = internalByAnchor || internalByActionCombo;

  // Write intent:
  // classify as write-intent only when there is some project/internal signal too.
  const isProjectWriteIntent =
    hasWriteAction && (hasAnchor || hasInternalAction || isProjectInternal);

  let confidence = "low";
  if (hasAnchor && hasWriteAction) confidence = "high";
  else if (hasAnchor) confidence = "high";
  else if (internalActionHits.length >= 2) confidence = "medium";
  else if (hasInternalAction || hasWriteAction) confidence = "low";
  else confidence = "none";

  return {
    isProjectInternal,
    isProjectWriteIntent,
    confidence,
    anchorHits,
    internalActionHits,
    writeActionHits,
  };
}

export default {
  PROJECT_INTENT_ANCHORS,
  PROJECT_INTENT_INTERNAL_ACTIONS,
  PROJECT_INTENT_WRITE_ACTIONS,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};