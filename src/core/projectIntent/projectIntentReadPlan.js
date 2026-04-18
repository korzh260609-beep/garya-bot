// src/core/projectIntent/projectIntentReadPlan.js
// ============================================================================
// STAGE 12A.0 — project read-plan resolver (SKELETON, semantic-first + follow-up)
// Purpose:
// - turn internal SG free-text read requests into a normalized semantic read-plan
// - separate INTENT from TARGET
// - support repo-followup continuity ("explain this", "translate this", etc.)
// - keep planning read-only
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

const PILLAR_FILE_RULES = Object.freeze([
  {
    path: "pillars/WORKFLOW.md",
    phrases: [
      "workflow.md",
      "документ workflow",
      "файл workflow",
      "workflow файл",
      "workflow document",
    ],
    basis: "pillar_workflow",
    entity: "workflow",
  },
  {
    path: "pillars/DECISIONS.md",
    phrases: [
      "decisions.md",
      "decision log",
      "журнал решений",
      "документ decisions",
      "файл decisions",
    ],
    basis: "pillar_decisions",
    entity: "decisions",
  },
  {
    path: "pillars/ROADMAP.md",
    phrases: [
      "roadmap.md",
      "документ roadmap",
      "файл roadmap",
      "дорожная карта",
    ],
    basis: "pillar_roadmap",
    entity: "roadmap",
  },
  {
    path: "pillars/PROJECT.md",
    phrases: [
      "project.md",
      "документ project",
      "файл project md",
      "описание проекта",
    ],
    basis: "pillar_project",
    entity: "project",
  },
  {
    path: "pillars/KINGDOM.md",
    phrases: [
      "kingdom.md",
      "документ kingdom",
      "файл kingdom",
    ],
    basis: "pillar_kingdom",
    entity: "kingdom",
  },
  {
    path: "pillars/SG_BEHAVIOR.md",
    phrases: [
      "sg_behavior.md",
      "sg behavior md",
      "поведение sg",
      "документ поведения sg",
    ],
    basis: "pillar_behavior",
    entity: "sg_behavior",
  },
  {
    path: "pillars/SG_ENTITY.md",
    phrases: [
      "sg_entity.md",
      "sg entity md",
      "сущность sg",
      "документ сущности sg",
    ],
    basis: "pillar_entity",
    entity: "sg_entity",
  },
  {
    path: "pillars/REPOINDEX.md",
    phrases: [
      "repoindex.md",
      "документ repoindex",
      "файл repoindex",
    ],
    basis: "pillar_repoindex",
    entity: "repoindex",
  },
  {
    path: "pillars/CODE_INSERT_RULES.md",
    phrases: [
      "code_insert_rules.md",
      "code insert rules",
      "правила вставки кода",
    ],
    basis: "pillar_code_insert_rules",
    entity: "code_insert_rules",
  },
]);

const ENTITY_RULES = Object.freeze([
  {
    entity: "workflow",
    targetKind: "canonical_doc",
    phrases: ["workflow", "воркфлоу", "workflow.md"],
    path: "pillars/WORKFLOW.md",
  },
  {
    entity: "decisions",
    targetKind: "canonical_doc",
    phrases: ["decisions", "decisions.md", "decision log", "журнал решений"],
    path: "pillars/DECISIONS.md",
  },
  {
    entity: "roadmap",
    targetKind: "canonical_doc",
    phrases: ["roadmap", "roadmap.md", "дорожная карта"],
    path: "pillars/ROADMAP.md",
  },
  {
    entity: "project",
    targetKind: "canonical_doc",
    phrases: ["project.md", "описание проекта"],
    path: "pillars/PROJECT.md",
  },
  {
    entity: "kingdom",
    targetKind: "canonical_doc",
    phrases: ["kingdom.md", "kingdom"],
    path: "pillars/KINGDOM.md",
  },
  {
    entity: "repoindex",
    targetKind: "canonical_doc",
    phrases: ["repoindex", "repoindex.md"],
    path: "pillars/REPOINDEX.md",
  },
  {
    entity: "pillars",
    targetKind: "repo_scope",
    phrases: ["pillars", "pillars/", "пилларс", "пиллары"],
    path: "pillars/",
  },
  {
    entity: "architecture",
    targetKind: "concept",
    phrases: ["architecture", "архитектура"],
    path: "",
  },
  {
    entity: "stage",
    targetKind: "stage",
    phrases: ["stage", "стадия", "этап"],
    path: "",
  },
]);

// ----------------------------------------------------------------------------
// SEMANTIC STEMS / FAMILIES
// ----------------------------------------------------------------------------

const SEARCH_STEM_PREFIXES = Object.freeze([
  "найд",
  "ищ",
  "поиск",
  "find",
  "search",
  "where",
  "locat",
]);

const ANALYZE_STEM_PREFIXES = Object.freeze([
  "анализ",
  "проанализ",
  "разбор",
  "объяс",
  "опис",
  "смысл",
  "review",
  "inspect",
  "analy",
  "explain",
]);

const READ_STEM_PREFIXES = Object.freeze([
  "отк",
  "покаж",
  "прочит",
  "show",
  "open",
  "read",
  "display",
]);

const CHECK_STEM_PREFIXES = Object.freeze([
  "пров",
  "стат",
  "check",
  "state",
  "status",
]);

const TRANSLATE_STEM_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "english",
  "украин",
  "translate",
]);

const SUMMARIZE_STEM_PREFIXES = Object.freeze([
  "кратк",
  "коротк",
  "прощ",
  "summary",
  "brief",
  "short",
  "simple",
]);

const FOLLOWUP_REFERENCE_TOKENS = Object.freeze([
  "это",
  "этот",
  "эту",
  "эти",
  "this",
  "it",
  "that",
  "теперь",
  "now",
]);

// ----------------------------------------------------------------------------
// GENERIC INTENT SIGNALS
// ----------------------------------------------------------------------------

const STATUS_PHRASES = Object.freeze([
  "repo status",
  "repository status",
  "status repo",
  "состояние репозитория",
  "статус репозитория",
  "статус проекта",
  "состояние проекта",
  "есть доступ к репозиторию",
  "доступ к github",
]);

const TREE_PHRASES = Object.freeze([
  "repo tree",
  "tree repo",
  "структура репозитория",
  "структура проекта",
  "дерево проекта",
  "дерево репозитория",
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
  "найди",
  "find",
  "search",
]);

const FILE_PHRASES = Object.freeze([
  "repo file",
  "open file",
  "show file",
  "read file",
  "открой файл",
  "покажи файл",
  "прочитай файл",
]);

const ANALYZE_PHRASES = Object.freeze([
  "repo analyze",
  "analyze repo",
  "analyze file",
  "проанализируй",
  "проанализировать",
  "анализ файла",
  "проверь логику",
  "проверь ошибку",
  "почему ломается",
  "где ошибка",
  "architecture review",
  "review code",
  "объясни",
  "дай описание",
  "объясни это",
  "explain this",
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
]);

const ANALYZE_DOC_PHRASES = Object.freeze([
  "проанализируй",
  "проанализировать",
  "analyze",
  "review",
  "inspect",
  "разбери",
  "объясни",
  "дай описание",
  "опиши",
  "переведи",
  "на русском",
  "по-русски",
  "кратко",
  "проще",
]);

const CHECK_ACTION_PHRASES = Object.freeze([
  "check",
  "проверь",
  "статус",
  "state",
  "status",
  "проверка",
]);

const REPO_ACCESS_META_PHRASES = Object.freeze([
  "do you have access to the repo",
  "do you have access to repository",
  "do you have access to github",
  "can you read the repo",
  "can you see the repo",
  "can you access github",
  "repo access",
  "repository access",
  "github access",

  "у тебя есть доступ к репозиторию",
  "у тебя есть доступ к github",
  "ты видишь репозиторий",
  "ты видишь github",
  "ты можешь читать репозиторий",
  "ты можешь открыть репозиторий",
  "ты подключен к github",
  "есть доступ к репозиторию",
  "есть доступ к github",
  "доступ к репозиторию",
  "доступ к github",
  "подключение к github",
  "подключение к репозиторию",
]);

const REPO_ACCESS_META_TOKENS = Object.freeze([
  "access",
  "connected",
  "connection",
  "видишь",
  "доступ",
  "подключение",
  "подключен",
  "читать",
  "read",
  "see",
]);

const REPO_ACCESS_META_PREFIXES = Object.freeze([
  "доступ",
  "подключ",
  "вид",
  "чит",
  "access",
  "connect",
  "read",
  "see",
]);

const REPO_TARGET_PREFIXES = Object.freeze([
  "репозитор",
  "репо",
  "github",
  "гитхаб",
  "repo",
  "repositor",
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
  "объясни",
  "описание",
  "переведи",
  "русском",
  "кратко",
  "проще",
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

const DIFF_TOKENS = Object.freeze([
  "diff",
  "patch",
  "изменения",
  "патч",
]);

function resolvePillarFileMatch(normalized) {
  for (const rule of PILLAR_FILE_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    if (phraseHits.length) {
      return {
        canonicalPillarPath: rule.path,
        canonicalPillarBasis: rule.basis,
        canonicalPillarPhraseHits: phraseHits,
        canonicalPillarTokenHits: [],
        canonicalPillarEntity: rule.entity,
      };
    }
  }

  return {
    canonicalPillarPath: "",
    canonicalPillarBasis: "",
    canonicalPillarPhraseHits: [],
    canonicalPillarTokenHits: [],
    canonicalPillarEntity: "",
  };
}

function looksLikeReadDocumentIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, READ_DOC_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["open", "show", "read", "открой", "покажи", "прочитай"]);
  const prefixHits = collectPrefixHits(tokens, READ_STEM_PREFIXES);
  return phraseHits.length > 0 || tokenHits.length > 0 || prefixHits.length > 0;
}

function looksLikeAnalyzeDocumentIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, ANALYZE_DOC_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["analyze", "review", "inspect", "проанализируй", "разбери", "объясни"]);
  const analyzePrefixHits = collectPrefixHits(tokens, ANALYZE_STEM_PREFIXES);
  const translatePrefixHits = collectPrefixHits(tokens, TRANSLATE_STEM_PREFIXES);
  const summarizePrefixHits = collectPrefixHits(tokens, SUMMARIZE_STEM_PREFIXES);
  return (
    phraseHits.length > 0 ||
    tokenHits.length > 0 ||
    analyzePrefixHits.length > 0 ||
    translatePrefixHits.length > 0 ||
    summarizePrefixHits.length > 0
  );
}

function looksLikeCheckIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, CHECK_ACTION_PHRASES);
  const tokenHits = collectTokenHits(tokens, ["check", "status", "state", "проверь", "статус"]);
  const prefixHits = collectPrefixHits(tokens, CHECK_STEM_PREFIXES);
  return phraseHits.length > 0 || tokenHits.length > 0 || prefixHits.length > 0;
}

function looksLikeRepoAccessMetaIntent(normalized, tokens) {
  const phraseHits = collectPhraseHits(normalized, REPO_ACCESS_META_PHRASES);
  const tokenHits = collectTokenHits(tokens, REPO_ACCESS_META_TOKENS);
  const prefixHits = collectPrefixHits(tokens, REPO_ACCESS_META_PREFIXES);
  const repoTargetHits = collectPrefixHits(tokens, REPO_TARGET_PREFIXES);

  const hasRepoAccessMetaSignal =
    phraseHits.length > 0 ||
    (
      prefixHits.length > 0 &&
      repoTargetHits.length > 0
    ) ||
    (
      tokenHits.length > 0 &&
      repoTargetHits.length > 0
    );

  return {
    phraseHits,
    tokenHits,
    prefixHits,
    repoTargetHits,
    hasRepoAccessMetaSignal,
  };
}

function resolveSemanticTarget({
  normalized,
  pathHints,
  hasPillarsRootSignal,
  canonicalPillarPath,
  canonicalPillarEntity,
  followupContext = null,
}) {
  if (canonicalPillarPath) {
    return {
      targetKind: "canonical_doc",
      targetEntity: canonicalPillarEntity || canonicalPillarPath,
      targetPath: canonicalPillarPath,
      targetBasis: ["canonical_pillar_exact"],
    };
  }

  if (pathHints.length > 0) {
    return {
      targetKind: "path",
      targetEntity: pathHints[0],
      targetPath: pathHints[0],
      targetBasis: ["explicit_path_hint"],
    };
  }

  if (hasPillarsRootSignal) {
    return {
      targetKind: "repo_scope",
      targetEntity: "pillars",
      targetPath: "pillars/",
      targetBasis: ["pillars_root_scope"],
    };
  }

  for (const rule of ENTITY_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    if (phraseHits.length > 0) {
      return {
        targetKind: rule.targetKind,
        targetEntity: rule.entity,
        targetPath: rule.path || "",
        targetBasis: [`entity:${rule.entity}`],
      };
    }
  }

  if (followupContext?.isActive) {
    return {
      targetKind: safeTargetKind(followupContext.targetKind),
      targetEntity: String(followupContext.targetEntity || "").trim(),
      targetPath: String(followupContext.targetPath || "").trim(),
      targetBasis: ["followup_repo_context"],
    };
  }

  return {
    targetKind: "unknown",
    targetEntity: "",
    targetPath: "",
    targetBasis: [],
  };
}

function safeTargetKind(value) {
  const v = String(value || "").trim();
  if (!v) return "unknown";
  return v;
}

function hasAnyPrefix(tokens, prefixes) {
  return collectPrefixHits(tokens, prefixes).length > 0;
}

function resolveIntentType({
  hasRepoAccessMetaSignal,
  hasStatusSignal,
  hasTreeSignal,
  hasDiffSignal,
  hasAnalyzeSignal,
  hasSearchSignal,
  hasFileSignal,
  isReadDocumentIntent,
  isAnalyzeDocumentIntent,
  isCheckIntent,
  targetKind,
  targetEntity,
  tokens,
  followupContext = null,
}) {
  const hasSearchStem = hasAnyPrefix(tokens, SEARCH_STEM_PREFIXES);
  const hasAnalyzeStem = hasAnyPrefix(tokens, ANALYZE_STEM_PREFIXES);
  const hasTranslateStem = hasAnyPrefix(tokens, TRANSLATE_STEM_PREFIXES);
  const hasSummarizeStem = hasAnyPrefix(tokens, SUMMARIZE_STEM_PREFIXES);

  if (hasRepoAccessMetaSignal) return "repo_status_check";
  if (hasStatusSignal) return "repo_status_check";
  if (hasTreeSignal) return "browse_tree";
  if (hasDiffSignal) return "compare_diff";

  if ((hasSearchSignal || hasSearchStem) && (hasAnalyzeSignal || hasAnalyzeStem || hasTranslateStem || hasSummarizeStem) && (targetEntity || targetKind !== "unknown")) {
    return "find_and_analyze";
  }

  if (targetEntity === "workflow" && isCheckIntent) {
    return "workflow_check";
  }

  if (targetEntity === "stage" && isCheckIntent) {
    return "stage_check";
  }

  if ((hasTranslateStem || hasSummarizeStem) && (targetKind === "canonical_doc" || targetKind === "path" || followupContext?.isActive)) {
    return "read_and_explain";
  }

  if (isAnalyzeDocumentIntent && (targetKind === "canonical_doc" || targetKind === "path" || followupContext?.isActive)) {
    return "read_and_explain";
  }

  if (isReadDocumentIntent && (targetKind === "canonical_doc" || targetKind === "path")) {
    return "read_file";
  }

  if (hasAnalyzeSignal || hasAnalyzeStem || hasTranslateStem || hasSummarizeStem) return "analyze_target";
  if (hasFileSignal) return "read_file";
  if (hasSearchSignal || hasSearchStem) return "find_target";

  return "generic_internal_read";
}

function resolvePlanKey({
  intentType,
  targetEntity,
  targetKind,
  targetPath,
}) {
  if (intentType === "repo_status_check") return "repo_status";
  if (intentType === "browse_tree") return "repo_tree";
  if (intentType === "compare_diff") return "repo_diff";
  if (intentType === "workflow_check") return "workflow_check";
  if (intentType === "stage_check") return "stage_check";

  if (intentType === "read_file") return "repo_file";
  if (intentType === "read_and_explain") return "repo_analyze";
  if (intentType === "find_and_analyze") {
    if (targetPath) return "repo_analyze";
    return "repo_search";
  }
  if (intentType === "analyze_target") {
    if (targetPath) return "repo_analyze";
    return "repo_search";
  }
  if (intentType === "find_target") return "repo_search";

  if (targetKind === "canonical_doc" && targetPath) return "repo_file";
  if (targetKind === "path" && targetPath) return "repo_file";
  if (targetEntity) return "repo_search";

  return "generic_internal_read";
}

function resolveRecommendedCommand(planKey) {
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

function resolveNeedsClarification({
  intentType,
  planKey,
  targetEntity,
  targetPath,
  targetKind,
}) {
  if (intentType === "repo_status_check") {
    return { needsClarification: false, clarificationQuestion: "" };
  }

  if (planKey === "workflow_check") {
    return { needsClarification: false, clarificationQuestion: "" };
  }

  if (planKey === "stage_check" && !targetEntity && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Какой именно stage нужно проверить?",
    };
  }

  if ((planKey === "repo_file" || planKey === "repo_analyze") && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Какой именно файл или документ открыть?",
    };
  }

  if (planKey === "repo_search" && !targetEntity && targetKind === "unknown") {
    return {
      needsClarification: true,
      clarificationQuestion: "Что именно искать в репозитории?",
    };
  }

  return { needsClarification: false, clarificationQuestion: "" };
}

function resolveConfidence({
  hasRepoAccessMetaSignal,
  targetKind,
  targetPath,
  targetEntity,
  intentType,
  needsClarification,
  followupContext = null,
}) {
  if (needsClarification) return "low";
  if (hasRepoAccessMetaSignal) return "high";
  if (followupContext?.isActive && targetPath) return "high";
  if (targetKind === "canonical_doc" && targetPath) return "high";
  if (targetKind === "path" && targetPath) return "high";
  if (intentType === "workflow_check" && targetEntity === "workflow") return "high";
  if (targetEntity) return "medium";
  return "low";
}

function resolveAnalyzeQuestion({ text, intentType, planKey, targetPath }) {
  const original = String(text || "").trim();
  if (!original) return "";

  if (planKey !== "repo_analyze") return "";
  if (!targetPath) return "";

  if (
    intentType === "read_and_explain" ||
    intentType === "find_and_analyze" ||
    intentType === "analyze_target"
  ) {
    return original;
  }

  return "";
}

export function resolveProjectIntentReadPlan({
  text,
  route = null,
  followupContext = null,
} = {}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

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
  const diffTokenHits = collectTokenHits(tokens, DIFF_TOKENS);

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

  const hasAnalyzeSignal = analyzePhraseHits.length > 0 || analyzeTokenHits.length > 0;
  const hasFileSignal = filePhraseHits.length > 0 || fileTokenHits.length > 0;
  const hasSearchSignal = searchPhraseHits.length > 0 || searchTokenHits.length > 0;
  const hasTreeSignal = treePhraseHits.length > 0 || treeTokenHits.length > 0;
  const hasStatusSignal = statusPhraseHits.length > 0 || statusTokenHits.length > 0;
  const hasDiffSignal = diffPhraseHits.length > 0 || diffTokenHits.length > 0;

  const isReadDocumentIntent = looksLikeReadDocumentIntent(normalized, tokens);
  const isAnalyzeDocumentIntent = looksLikeAnalyzeDocumentIntent(normalized, tokens);
  const isCheckIntent = looksLikeCheckIntent(normalized, tokens);

  const semanticTarget = resolveSemanticTarget({
    normalized,
    pathHints,
    hasPillarsRootSignal,
    canonicalPillarPath,
    canonicalPillarEntity,
    followupContext,
  });

  const intentType = resolveIntentType({
    hasRepoAccessMetaSignal,
    hasStatusSignal,
    hasTreeSignal,
    hasDiffSignal,
    hasAnalyzeSignal,
    hasSearchSignal,
    hasFileSignal,
    isReadDocumentIntent,
    isAnalyzeDocumentIntent,
    isCheckIntent,
    targetKind: semanticTarget.targetKind,
    targetEntity: semanticTarget.targetEntity,
    tokens,
    followupContext,
  });

  const planKey = resolvePlanKey({
    intentType,
    targetEntity: semanticTarget.targetEntity,
    targetKind: semanticTarget.targetKind,
    targetPath: semanticTarget.targetPath,
  });

  const recommendedCommand = resolveRecommendedCommand(planKey);

  const clarification = resolveNeedsClarification({
    intentType,
    planKey,
    targetEntity: semanticTarget.targetEntity,
    targetPath: semanticTarget.targetPath,
    targetKind: semanticTarget.targetKind,
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
    intentType,
    planKey,
    targetPath: semanticTarget.targetPath,
  });

  const basis = unique([
    ...semanticTarget.targetBasis,
    canonicalPillarBasis,
    followupContext?.isActive ? "followup_context_active" : "",
    hasRepoAccessMetaSignal ? "repo_access_meta" : "",
    hasSearchSignal ? "search_signal" : "",
    hasAnalyzeSignal ? "analyze_signal" : "",
    hasFileSignal ? "file_signal" : "",
    hasTreeSignal ? "tree_signal" : "",
    hasStatusSignal ? "status_signal" : "",
    hasDiffSignal ? "diff_signal" : "",
    isReadDocumentIntent ? "read_document_intent" : "",
    isAnalyzeDocumentIntent ? "analyze_document_intent" : "",
    isCheckIntent ? "check_intent" : "",
    intentType ? `intent:${intentType}` : "",
  ]);

  const searchEntityHints = unique([
    semanticTarget.targetEntity,
    semanticTarget.targetPath,
    canonicalPillarPath,
    hasPillarsRootSignal ? "pillars/" : "",
    followupContext?.targetEntity || "",
    followupContext?.targetPath || "",
  ]);

  const queryHints = unique([
    ...searchPhraseHits,
    ...searchTokenHits,
    ...analyzePhraseHits,
    ...analyzeTokenHits,
    ...pillarsRootPhraseHits,
    ...pillarsRootTokenHits,
    ...canonicalPillarPhraseHits,
    ...canonicalPillarTokenHits,
    ...repoAccessMetaPhraseHits,
    ...repoAccessMetaTokenHits,
    ...repoAccessMetaPrefixHits,
    ...repoTargetHits,
  ]);

  const routeKey = String(route?.routeKey || "").trim();
  const routeAllowsInternalRead =
    routeKey === "sg_core_internal_read_allowed";

  return {
    normalized,
    tokens,

    statusPhraseHits,
    treePhraseHits,
    searchPhraseHits,
    filePhraseHits,
    analyzePhraseHits,
    diffPhraseHits,

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

    repoAccessMetaPhraseHits,
    repoAccessMetaTokenHits,
    repoAccessMetaPrefixHits,
    repoTargetHits,
    hasRepoAccessMetaSignal,

    canonicalPillarPath,
    canonicalPillarBasis,
    canonicalPillarEntity,
    hasPillarsRootSignal,

    isReadDocumentIntent,
    isAnalyzeDocumentIntent,
    isCheckIntent,

    pathHints,
    primaryPathHint: pickFirstNonEmpty(pathHints) || pickFirstNonEmpty([canonicalPillarPath]),
    queryHints,
    searchEntityHints,

    // semantic model
    intentType,
    targetKind: semanticTarget.targetKind,
    targetEntity: semanticTarget.targetEntity,
    targetPath: semanticTarget.targetPath,
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