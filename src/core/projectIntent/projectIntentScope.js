// src/core/projectIntent/projectIntentScope.js
// ============================================================================
// STAGE 12A.0 — project free-text intent scope (SKELETON)
// Purpose:
// - detect likely INTERNAL SG project/repo/workflow requests in free text
// - used only as a guard signal before chat AI flow
// - NO repo writes, NO command execution, NO side effects
// IMPORTANT:
// - keep matcher conservative enough to reduce false positives
// - strong markers = direct/internal SG signals
// - weak markers = generic repo/workflow/architecture signals
// ============================================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const PROJECT_INTENT_STRONG_MARKERS = Object.freeze([
  "garya-bot",
  "советник garya",
  "проект sg",
  "sg project",
  "workflow_check",
  "stage_check",
  "/workflow_check",
  "/stage_check",
  "pillars/",
  "worklow.md", // defensive typo tolerance
  "workflow.md",
  "roadmap.md",
  "decisions.md",
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

export const PROJECT_INTENT_WEAK_MARKERS = Object.freeze([
  "repo",
  "repository",
  "github",
  "workflow",
  "roadmap",
  "pillars",
  "stage check",
  "stage-check",
  "architecture",
  "архитектура",
  "архитектур",
  "репозитор",
  "код проекта",
  "проверь код",
  "проверь репо",
  "проверь репозиторий",
  "посмотри репо",
  "посмотри репозиторий",
  "check my repo",
  "check repo",
  "look into my repo",
  "analyze my repo",
  "analyze sg project",
  "check sg architecture",
  "check workflow",
]);

export function collectProjectIntentSignals(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      normalized,
      strongHits: [],
      weakHits: [],
    };
  }

  const strongHits = PROJECT_INTENT_STRONG_MARKERS.filter((marker) =>
    normalized.includes(marker)
  );

  const weakHits = PROJECT_INTENT_WEAK_MARKERS.filter((marker) =>
    normalized.includes(marker)
  );

  return {
    normalized,
    strongHits,
    weakHits,
  };
}

export function resolveProjectIntentMatch(text) {
  const { normalized, strongHits, weakHits } = collectProjectIntentSignals(text);

  if (!normalized) {
    return {
      isProjectInternal: false,
      confidence: "none",
      strongHits,
      weakHits,
    };
  }

  // Conservative rule:
  // - 1 strong marker is enough
  // - OR at least 2 weak markers are enough
  // This reduces false positives on generic words like "repo" or "workflow".
  const hasStrong = strongHits.length >= 1;
  const hasWeakCombo = weakHits.length >= 2;

  if (hasStrong) {
    return {
      isProjectInternal: true,
      confidence: "high",
      strongHits,
      weakHits,
    };
  }

  if (hasWeakCombo) {
    return {
      isProjectInternal: true,
      confidence: "medium",
      strongHits,
      weakHits,
    };
  }

  return {
    isProjectInternal: false,
    confidence: "low",
    strongHits,
    weakHits,
  };
}

export default {
  PROJECT_INTENT_STRONG_MARKERS,
  PROJECT_INTENT_WEAK_MARKERS,
  collectProjectIntentSignals,
  resolveProjectIntentMatch,
};