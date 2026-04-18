// src/core/projectIntent/projectIntentReadPlan.js
// ============================================================================
// STAGE 12A.0 — project read-plan resolver (SKELETON)
// Purpose:
// - turn internal SG free-text read requests into a normalized read-plan
// - keep plan semantic and read-only
// - prepare future bridge: human text -> repo read/search/analyze action
// IMPORTANT:
// - NO command execution
// - NO repo writes
// - NO side effects
// - planning only
// ============================================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'`~@#$%^&*+=]+/g, " ")
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

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

const WORKFLOW_PHRASES = Object.freeze([
  "workflow",
  "workflow.md",
  "воркфлоу",
  "workflow check",
  "check workflow",
  "проверь workflow",
  "покажи workflow",
]);

const STAGE_PHRASES = Object.freeze([
  "stage check",
  "stage-check",
  "check stage",
  "проверь stage",
  "стадия",
  "этап",
  "этап проекта",
]);

const STATUS_PHRASES = Object.freeze([
  "repo status",
  "repository status",
  "status repo",
  "состояние репозитория",
  "статус репозитория",
  "статус проекта",
  "состояние проекта",
]);

const TREE_PHRASES = Object.freeze([
  "repo tree",
  "tree repo",
  "структура репозитория",
  "структура проекта",
  "дерево проекта",
  "дерево репозитория",
  "покажи структуру",
  "show tree",
]);

const SEARCH_PHRASES = Object.freeze([
  "repo search",
  "search repo",
  "найди в репо",
  "найди в проекте",
  "поиск по репо",
  "поиск по проекту",
  "где находится",
  "where is",
  "find in repo",
]);

const FILE_PHRASES = Object.freeze([
  "repo file",
  "open file",
  "show file",
  "открой файл",
  "покажи файл",
  "файл ",
  "path ",
  "путь ",
]);

const ANALYZE_PHRASES = Object.freeze([
  "repo analyze",
  "analyze repo",
  "analyze file",
  "проанализируй",
  "проверь логику",
  "проверь ошибку",
  "почему ломается",
  "где ошибка",
  "architecture review",
  "review code",
]);

const DIFF_PHRASES = Object.freeze([
  "repo diff",
  "show diff",
  "покажи diff",
  "покажи изменения",
  "что изменилось",
  "patch",
  "патч",
]);

const PATH_HINT_PATTERNS = [
  /(?:^|\s)(src\/[^\s]+)/i,
  /(?:^|\s)(pillars\/[^\s]+)/i,
  /(?:^|\s)(docs\/[^\s]+)/i,
  /(?:^|\s)([^()\s]+\.(?:js|mjs|cjs|json|md|txt|sql|yaml|yml))/i,
];

const SEARCH_TOKENS = Object.freeze([
  "find",
  "search",
  "where",
  "найди",
  "поиск",
  "где",
]);

const FILE_TOKENS = Object.freeze([
  "file",
  "path",
  "файл",
  "путь",
  "открой",
  "open",
]);

const ANALYZE_TOKENS = Object.freeze([
  "analyze",
  "review",
  "inspect",
  "error",
  "bug",
  "problem",
  "logic",
  "архитектура",
  "анализ",
  "ошибка",
  "проблема",
  "логика",
]);

const TREE_TOKENS = Object.freeze([
  "tree",
  "structure",
  "folders",
  "дерево",
  "структура",
  "папки",
]);

const STATUS_TOKENS = Object.freeze([
  "status",
  "state",
  "статус",
  "состояние",
]);

const WORKFLOW_TOKENS = Object.freeze([
  "workflow",
  "воркфлоу",
]);

const STAGE_TOKENS = Object.freeze([
  "stage",
  "стадия",
  "этап",
]);

const DIFF_TOKENS = Object.freeze([
  "diff",
  "patch",
  "изменения",
  "патч",
]);

function extractPathHints(text) {
  const raw = String(text || "");
  const hits = [];

  for (const pattern of PATH_HINT_PATTERNS) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      hits.push(String(match[1]).trim());
    }
  }

  return unique(hits);
}

function resolvePlanPreview(plan) {
  const key = String(plan?.planKey || "").trim();

  if (key === "workflow_check") return "workflow/state reading path";
  if (key === "stage_check") return "stage reading path";
  if (key === "repo_status") return "repo status reading path";
  if (key === "repo_tree") return "repo tree reading path";
  if (key === "repo_file") return "repo file reading path";
  if (key === "repo_search") return "repo search reading path";
  if (key === "repo_analyze") return "repo analysis reading path";
  if (key === "repo_diff") return "repo diff reading path";

  return "generic internal read path";
}

export function resolveProjectIntentReadPlan({
  text,
  route = null,
} = {}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const workflowPhraseHits = collectPhraseHits(normalized, WORKFLOW_PHRASES);
  const stagePhraseHits = collectPhraseHits(normalized, STAGE_PHRASES);
  const statusPhraseHits = collectPhraseHits(normalized, STATUS_PHRASES);
  const treePhraseHits = collectPhraseHits(normalized, TREE_PHRASES);
  const searchPhraseHits = collectPhraseHits(normalized, SEARCH_PHRASES);
  const filePhraseHits = collectPhraseHits(normalized, FILE_PHRASES);
  const analyzePhraseHits = collectPhraseHits(normalized, ANALYZE_PHRASES);
  const diffPhraseHits = collectPhraseHits(normalized, DIFF_PHRASES);

  const searchTokenHits = collectTokenHits(tokens, SEARCH_TOKENS);
  const fileTokenHits = collectTokenHits(tokens, FILE_TOKENS);
  const analyzeTokenHits = collectTokenHits(tokens, ANALYZE_TOKENS);
  const treeTokenHits = collectTokenHits(tokens, TREE_TOKENS);
  const statusTokenHits = collectTokenHits(tokens, STATUS_TOKENS);
  const workflowTokenHits = collectTokenHits(tokens, WORKFLOW_TOKENS);
  const stageTokenHits = collectTokenHits(tokens, STAGE_TOKENS);
  const diffTokenHits = collectTokenHits(tokens, DIFF_TOKENS);

  const pathHints = extractPathHints(text);

  const basis = [];
  let planKey = "generic_internal_read";
  let recommendedCommand = "/repo_search";
  let confidence = "low";

  if (workflowPhraseHits.length || workflowTokenHits.length) {
    planKey = "workflow_check";
    recommendedCommand = "/workflow_check";
    confidence = workflowPhraseHits.length ? "high" : "medium";
    basis.push("workflow_signal");
  } else if (stagePhraseHits.length || stageTokenHits.length) {
    planKey = "stage_check";
    recommendedCommand = "/stage_check";
    confidence = stagePhraseHits.length ? "high" : "medium";
    basis.push("stage_signal");
  } else if (statusPhraseHits.length || statusTokenHits.length) {
    planKey = "repo_status";
    recommendedCommand = "/repo_status";
    confidence = statusPhraseHits.length ? "high" : "medium";
    basis.push("status_signal");
  } else if (treePhraseHits.length || treeTokenHits.length) {
    planKey = "repo_tree";
    recommendedCommand = "/repo_tree";
    confidence = treePhraseHits.length ? "high" : "medium";
    basis.push("tree_signal");
  } else if (pathHints.length || filePhraseHits.length || fileTokenHits.length) {
    planKey = "repo_file";
    recommendedCommand = "/repo_file";
    confidence = pathHints.length ? "high" : "medium";
    basis.push(pathHints.length ? "path_hint" : "file_signal");
  } else if (diffPhraseHits.length || diffTokenHits.length) {
    planKey = "repo_diff";
    recommendedCommand = "/repo_diff";
    confidence = diffPhraseHits.length ? "high" : "medium";
    basis.push("diff_signal");
  } else if (analyzePhraseHits.length || analyzeTokenHits.length) {
    planKey = "repo_analyze";
    recommendedCommand = "/repo_analyze";
    confidence = analyzePhraseHits.length ? "high" : "medium";
    basis.push("analyze_signal");
  } else if (searchPhraseHits.length || searchTokenHits.length) {
    planKey = "repo_search";
    recommendedCommand = "/repo_search";
    confidence = searchPhraseHits.length ? "high" : "medium";
    basis.push("search_signal");
  }

  const queryHints = unique([
    ...searchPhraseHits,
    ...searchTokenHits,
    ...analyzePhraseHits,
    ...analyzeTokenHits,
  ]);

  const primaryPathHint = pickFirstNonEmpty(pathHints);

  const routeKey = String(route?.routeKey || "").trim();
  const routeAllowsInternalRead =
    routeKey === "sg_core_internal_read_allowed";

  return {
    normalized,
    tokens,

    workflowPhraseHits,
    stagePhraseHits,
    statusPhraseHits,
    treePhraseHits,
    searchPhraseHits,
    filePhraseHits,
    analyzePhraseHits,
    diffPhraseHits,

    workflowTokenHits,
    stageTokenHits,
    statusTokenHits,
    treeTokenHits,
    searchTokenHits,
    fileTokenHits,
    analyzeTokenHits,
    diffTokenHits,

    pathHints,
    primaryPathHint,
    queryHints,

    planKey,
    recommendedCommand,
    confidence,
    basis: unique(basis),

    routeKey,
    routeAllowsInternalRead,

    preview: resolvePlanPreview({ planKey }),
  };
}

export default {
  resolveProjectIntentReadPlan,
};