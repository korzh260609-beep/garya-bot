// src/core/projectIntent/projectIntentReadPlan.js
// ============================================================================
// STAGE 12A.0 — project read-plan resolver (SKELETON)
// Purpose:
// - turn internal SG free-text read requests into a normalized read-plan
// - keep plan semantic and read-only
// - prepare future bridge: human text -> repo read/search/analyze action
// - respect canonical SG governance layer first: pillars/*
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
    .replace(/[.,!?;:()[\]{}<>\\|"'\`~@#$%^&*+=]+/g, " ")
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

// ----------------------------------------------------------------------------
// CANONICAL SG GOVERNANCE LAYER — PILLARS
// ----------------------------------------------------------------------------

const PILLARS_ROOT_PHRASES = Object.freeze([
  "pillars",
  "pillars/",
  "pillar",
  "пилларс",
  "пиллары",
  "канонические документы sg",
  "основные документы sg",
  "законодательная база sg",
  "база правил sg",
  "база проекта sg",
]);

const PILLARS_ROOT_TOKENS = Object.freeze([
  "pillars",
  "pillar",
  "пилларс",
  "пиллары",
]);

// NOTE:
// Keep these mappings conservative.
// We map to canonical files only when the request semantically looks like:
// - open/show/read document
// - analyze that canonical document
// We do NOT want broad generic words to hijack the whole repo flow.
const PILLAR_FILE_RULES = Object.freeze([
  {
    path: "pillars/WORKFLOW.md",
    phrases: [
      "workflow.md",
      "документ workflow",
      "файл workflow",
      "открой workflow md",
      "покажи workflow md",
      "прочитай workflow md",
      "открой документ workflow",
      "покажи документ workflow",
    ],
    tokens: [],
    basis: "pillar_workflow",
  },
  {
    path: "pillars/DECISIONS.md",
    phrases: [
      "decisions.md",
      "decision log",
      "журнал решений sg",
      "документ decisions",
      "файл decisions",
      "открой decisions",
      "покажи decisions",
      "прочитай decisions",
    ],
    tokens: [],
    basis: "pillar_decisions",
  },
  {
    path: "pillars/ROADMAP.md",
    phrases: [
      "roadmap.md",
      "документ roadmap",
      "файл roadmap",
      "открой roadmap",
      "покажи roadmap",
      "прочитай roadmap",
      "дорожная карта документ",
    ],
    tokens: [],
    basis: "pillar_roadmap",
  },
  {
    path: "pillars/PROJECT.md",
    phrases: [
      "project.md",
      "документ project",
      "файл project md",
      "открой project md",
      "покажи project md",
      "прочитай project md",
      "документ описания проекта",
    ],
    tokens: [],
    basis: "pillar_project",
  },
  {
    path: "pillars/KINGDOM.md",
    phrases: [
      "kingdom.md",
      "документ kingdom",
      "файл kingdom",
      "открой kingdom",
      "покажи kingdom",
      "прочитай kingdom",
    ],
    tokens: [],
    basis: "pillar_kingdom",
  },
  {
    path: "pillars/SG_BEHAVIOR.md",
    phrases: [
      "sg_behavior.md",
      "sg behavior md",
      "документ поведения sg",
      "файл поведения sg",
      "открой поведение sg",
      "покажи поведение sg",
      "прочитай поведение sg",
    ],
    tokens: [],
    basis: "pillar_behavior",
  },
  {
    path: "pillars/SG_ENTITY.md",
    phrases: [
      "sg_entity.md",
      "sg entity md",
      "документ сущности sg",
      "файл сущности sg",
      "открой сущность sg",
      "покажи сущность sg",
      "прочитай сущность sg",
    ],
    tokens: [],
    basis: "pillar_entity",
  },
  {
    path: "pillars/REPOINDEX.md",
    phrases: [
      "repoindex.md",
      "документ repoindex",
      "файл repoindex",
      "открой repoindex",
      "покажи repoindex",
      "прочитай repoindex",
    ],
    tokens: [],
    basis: "pillar_repoindex",
  },
  {
    path: "pillars/CODE_INSERT_RULES.md",
    phrases: [
      "code_insert_rules.md",
      "code insert rules",
      "документ правил вставки кода",
      "файл правил вставки кода",
      "открой правила вставки кода",
      "покажи правила вставки кода",
      "прочитай правила вставки кода",
    ],
    tokens: [],
    basis: "pillar_code_insert_rules",
  },
]);

// ----------------------------------------------------------------------------
// GENERIC INTENT SIGNALS
// ----------------------------------------------------------------------------

const WORKFLOW_PHRASES = Object.freeze([
  "workflow",
  "workflow.md",
  "воркфлоу",
  "workflow check",
  "check workflow",
  "проверь workflow",
  "покажи workflow статус",
  "статус workflow",
]);

const STAGE_PHRASES = Object.freeze([
  "stage check",
  "stage-check",
  "check stage",
  "проверь stage",
  "стадия",
  "этап",
  "этап проекта",
  "статус этапа",
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
  "read file",
  "открой файл",
  "покажи файл",
  "прочитай файл",
  "файл ",
  "path ",
  "путь ",
]);

const ANALYZE_PHRASES = Object.freeze([
  "repo analyze",
  "analyze repo",
  "analyze file",
  "проанализируй",
  "анализ файла",
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

const READ_DOC_PHRASES = Object.freeze([
  "открой",
  "покажи",
  "прочитай",
  "show",
  "open",
  "read",
  "display",
  "show me",
  "open file",
  "show file",
  "read file",
]);

const ANALYZE_DOC_PHRASES = Object.freeze([
  "проанализируй",
  "analyze",
  "review",
  "inspect",
  "разбери",
  "проверь логику",
  "проверь документ",
]);

const CHECK_ACTION_PHRASES = Object.freeze([
  "check",
  "проверь",
  "статус",
  "state",
  "status",
  "проверка",
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
  "read",
  "прочитай",
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
  "разбор",
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

function resolvePillarFileMatch(normalized, tokens) {
  for (const rule of PILLAR_FILE_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    const tokenHits = collectTokenHits(tokens, rule.tokens || []);

    if (phraseHits.length || tokenHits.length) {
      return {
        canonicalPillarPath: rule.path,
        canonicalPillarBasis: rule.basis,
        canonicalPillarPhraseHits: phraseHits,
        canonicalPillarTokenHits: tokenHits,
      };
    }
  }

  return {
    canonicalPillarPath: "",
    canonicalPillarBasis: "",
    canonicalPillarPhraseHits: [],
    canonicalPillarTokenHits: [],
  };
}

function looksLikeReadDocumentIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, READ_DOC_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["open", "show", "read", "открой", "покажи", "прочитай"]);
  return phraseHits.length > 0 || tokenHits.length > 0;
}

function looksLikeAnalyzeDocumentIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, ANALYZE_DOC_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["analyze", "review", "inspect", "проанализируй", "разбери"]);
  return phraseHits.length > 0 || tokenHits.length > 0;
}

function looksLikeCheckIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, CHECK_ACTION_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["check", "status", "state", "проверь", "статус"]);
  return phraseHits.length > 0 || tokenHits.length > 0;
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

  const pillarsRootPhraseHits = collectPhraseHits(normalized, PILLARS_ROOT_PHRASES);
  const pillarsRootTokenHits = collectTokenHits(tokens, PILLARS_ROOT_TOKENS);

  const {
    canonicalPillarPath,
    canonicalPillarBasis,
    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,
  } = resolvePillarFileMatch(normalized, tokens);

  const pathHints = extractPathHints(text);

  const basis = [];
  let planKey = "generic_internal_read";
  let recommendedCommand = "/repo_search";
  let confidence = "low";

  const hasPillarsRootSignal =
    pillarsRootPhraseHits.length >= 1 || pillarsRootTokenHits.length >= 1;

  const hasCanonicalPillarMatch = !!canonicalPillarPath;
  const hasAnalyzeSignal = analyzePhraseHits.length > 0 || analyzeTokenHits.length > 0;
  const hasFileSignal = filePhraseHits.length > 0 || fileTokenHits.length > 0;
  const hasSearchSignal = searchPhraseHits.length > 0 || searchTokenHits.length > 0;
  const hasWorkflowSignal = workflowPhraseHits.length > 0 || workflowTokenHits.length > 0;
  const hasStageSignal = stagePhraseHits.length > 0 || stageTokenHits.length > 0;
  const hasTreeSignal = treePhraseHits.length > 0 || treeTokenHits.length > 0;
  const hasStatusSignal = statusPhraseHits.length > 0 || statusTokenHits.length > 0;
  const hasDiffSignal = diffPhraseHits.length > 0 || diffTokenHits.length > 0;

  const isReadDocumentIntent = looksLikeReadDocumentIntent(normalized, tokens);
  const isAnalyzeDocumentIntent = looksLikeAnalyzeDocumentIntent(normalized, tokens);
  const isCheckIntent = looksLikeCheckIntent(normalized, tokens);

  // --------------------------------------------------------------------------
  // 1) SEMANTIC ACTIONS FIRST
  // --------------------------------------------------------------------------
  // Universal rule:
  // if the user asks to CHECK workflow/stage/status, we should not hijack
  // that into opening a canonical document.
  if (hasWorkflowSignal && isCheckIntent && !pathHints.length) {
    planKey = "workflow_check";
    recommendedCommand = "/workflow_check";
    confidence = workflowPhraseHits.length ? "high" : "medium";
    basis.push("workflow_check_semantic");
  } else if (hasStageSignal && isCheckIntent && !pathHints.length) {
    planKey = "stage_check";
    recommendedCommand = "/stage_check";
    confidence = stagePhraseHits.length ? "high" : "medium";
    basis.push("stage_check_semantic");
  } else if (hasStatusSignal) {
    planKey = "repo_status";
    recommendedCommand = "/repo_status";
    confidence = statusPhraseHits.length ? "high" : "medium";
    basis.push("status_signal");
  } else if (hasTreeSignal) {
    planKey = "repo_tree";
    recommendedCommand = "/repo_tree";
    confidence = treePhraseHits.length ? "high" : "medium";
    basis.push("tree_signal");
  }

  // --------------------------------------------------------------------------
  // 2) CANONICAL PILLAR DOCUMENT ACCESS
  // --------------------------------------------------------------------------
  else if (hasCanonicalPillarMatch && isAnalyzeDocumentIntent) {
    planKey = "repo_analyze";
    recommendedCommand = "/repo_analyze";
    confidence = "high";
    basis.push("canonical_pillar_analyze");
    basis.push(canonicalPillarBasis);
  } else if (hasCanonicalPillarMatch && isReadDocumentIntent) {
    planKey = "repo_file";
    recommendedCommand = "/repo_file";
    confidence = "high";
    basis.push("canonical_pillar_file");
    basis.push(canonicalPillarBasis);
  } else if (hasPillarsRootSignal && hasSearchSignal) {
    planKey = "repo_search";
    recommendedCommand = "/repo_search";
    confidence = "high";
    basis.push("pillars_root_search");
  } else if (hasPillarsRootSignal && hasTreeSignal) {
    // repo_tree cannot scope to pillars/ only,
    // so search is more semantically useful here.
    planKey = "repo_search";
    recommendedCommand = "/repo_search";
    confidence = "high";
    basis.push("pillars_root_tree_like");
  } else if (hasPillarsRootSignal && isReadDocumentIntent) {
    planKey = "repo_search";
    recommendedCommand = "/repo_search";
    confidence = "medium";
    basis.push("pillars_root_browse");
  }

  // --------------------------------------------------------------------------
  // 3) EXPLICIT PATHS / GENERIC FILE OPS
  // --------------------------------------------------------------------------
  else if (pathHints.length || hasFileSignal) {
    planKey = "repo_file";
    recommendedCommand = "/repo_file";
    confidence = pathHints.length ? "high" : "medium";
    basis.push(pathHints.length ? "path_hint" : "file_signal");
  } else if (hasDiffSignal) {
    planKey = "repo_diff";
    recommendedCommand = "/repo_diff";
    confidence = diffPhraseHits.length ? "high" : "medium";
    basis.push("diff_signal");
  } else if (hasAnalyzeSignal) {
    planKey = "repo_analyze";
    recommendedCommand = "/repo_analyze";
    confidence = analyzePhraseHits.length ? "high" : "medium";
    basis.push("analyze_signal");
  } else if (hasSearchSignal) {
    planKey = "repo_search";
    recommendedCommand = "/repo_search";
    confidence = searchPhraseHits.length ? "high" : "medium";
    basis.push("search_signal");
  }

  // --------------------------------------------------------------------------
  // 4) GENERIC FALLBACKS FOR MEANING
  // --------------------------------------------------------------------------
  else if (hasWorkflowSignal) {
    // No explicit check/document intent. Stay conservative.
    // Workflow is more often a semantic state question than a file-open request.
    planKey = "workflow_check";
    recommendedCommand = "/workflow_check";
    confidence = workflowPhraseHits.length ? "medium" : "low";
    basis.push("workflow_fallback_semantic");
  } else if (hasStageSignal) {
    planKey = "stage_check";
    recommendedCommand = "/stage_check";
    confidence = stagePhraseHits.length ? "medium" : "low";
    basis.push("stage_fallback_semantic");
  }

  const queryHints = unique([
    ...searchPhraseHits,
    ...searchTokenHits,
    ...analyzePhraseHits,
    ...analyzeTokenHits,
    ...pillarsRootPhraseHits,
    ...pillarsRootTokenHits,
    ...canonicalPillarPhraseHits,
    ...canonicalPillarTokenHits,
  ]);

  const primaryPathHint =
    pickFirstNonEmpty(pathHints) || pickFirstNonEmpty([canonicalPillarPath]);

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

    pillarsRootPhraseHits,
    pillarsRootTokenHits,
    canonicalPillarPhraseHits,
    canonicalPillarTokenHits,

    canonicalPillarPath,
    canonicalPillarBasis,
    hasPillarsRootSignal,
    hasCanonicalPillarMatch,

    isReadDocumentIntent,
    isAnalyzeDocumentIntent,
    isCheckIntent,

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