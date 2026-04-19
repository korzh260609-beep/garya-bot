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
// Canonical repo targets
// ----------------------------------------------------------------------------

const PILLARS_ROOT_PHRASES = Object.freeze([
  "pillars",
  "pillars/",
  "pillar",
  "пилларс",
  "пиллары",
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
    phrases: ["workflow.md", "документ workflow", "файл workflow", "workflow document"],
    basis: "pillar_workflow",
    entity: "workflow",
  },
  {
    path: "pillars/DECISIONS.md",
    phrases: ["decisions.md", "decision log", "журнал решений", "документ decisions"],
    basis: "pillar_decisions",
    entity: "decisions",
  },
  {
    path: "pillars/ROADMAP.md",
    phrases: ["roadmap.md", "документ roadmap", "дорожная карта"],
    basis: "pillar_roadmap",
    entity: "roadmap",
  },
  {
    path: "pillars/PROJECT.md",
    phrases: ["project.md", "описание проекта"],
    basis: "pillar_project",
    entity: "project",
  },
  {
    path: "pillars/KINGDOM.md",
    phrases: ["kingdom.md", "документ kingdom"],
    basis: "pillar_kingdom",
    entity: "kingdom",
  },
  {
    path: "pillars/SG_BEHAVIOR.md",
    phrases: ["sg_behavior.md", "поведение sg"],
    basis: "pillar_behavior",
    entity: "sg_behavior",
  },
  {
    path: "pillars/SG_ENTITY.md",
    phrases: ["sg_entity.md", "сущность sg"],
    basis: "pillar_entity",
    entity: "sg_entity",
  },
  {
    path: "pillars/REPOINDEX.md",
    phrases: ["repoindex.md", "repoindex"],
    basis: "pillar_repoindex",
    entity: "repoindex",
  },
  {
    path: "pillars/CODE_INSERT_RULES.md",
    phrases: ["code_insert_rules.md", "code insert rules", "правила вставки кода"],
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
    entity: "stage",
    targetKind: "stage",
    phrases: ["stage", "стадия", "этап"],
    path: "",
  },
]);

// ----------------------------------------------------------------------------
// Intent families
// ----------------------------------------------------------------------------

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
  "ты можешь читать репозиторий",
  "есть доступ к репозиторию",
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

const STATUS_PHRASES = Object.freeze([
  "repo status",
  "repository status",
  "статус репозитория",
  "состояние репозитория",
  "статус проекта",
  "состояние проекта",
]);

const TREE_PHRASES = Object.freeze([
  "repo tree",
  "структура репозитория",
  "структура проекта",
  "дерево репозитория",
]);

const DIFF_PHRASES = Object.freeze([
  "repo diff",
  "show diff",
  "покажи diff",
  "покажи изменения",
  "что изменилось",
]);

const SEARCH_PREFIXES = Object.freeze([
  "найд",
  "ищ",
  "поиск",
  "find",
  "search",
  "where",
  "locat",
]);

const READ_PREFIXES = Object.freeze([
  "отк",
  "покаж",
  "прочит",
  "show",
  "open",
  "read",
  "display",
]);

const EXPLAIN_PREFIXES = Object.freeze([
  "объяс",
  "опис",
  "анализ",
  "проанализ",
  "разбор",
  "review",
  "inspect",
  "analy",
  "explain",
]);

const TRANSLATE_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "англ",
  "translate",
]);

const SUMMARY_PREFIXES = Object.freeze([
  "кратк",
  "коротк",
  "прощ",
  "summary",
  "brief",
  "short",
  "simple",
]);

const CHECK_PREFIXES = Object.freeze([
  "пров",
  "стат",
  "check",
  "state",
  "status",
]);

const PATH_HINT_PATTERNS = [
  /(?:^|\s)(src\/[^\s]+)/i,
  /(?:^|\s)(pillars\/[^\s]+)/i,
  /(?:^|\s)(docs\/[^\s]+)/i,
  /(?:^|\s)([^()\s]+\.(?:js|mjs|cjs|json|md|txt|sql|yaml|yml))/i,
];

function resolvePillarFileMatch(normalized) {
  for (const rule of PILLAR_FILE_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    if (phraseHits.length > 0) {
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
  if (pathHints.length > 0) {
    return {
      targetKind: "path",
      targetEntity: pathHints[0],
      targetPath: pathHints[0],
      targetBasis: ["explicit_path_hint"],
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

  if (canonicalPillarPath) {
    return {
      targetKind: "canonical_doc",
      targetEntity: canonicalPillarEntity || canonicalPillarPath,
      targetPath: canonicalPillarPath,
      targetBasis: ["canonical_pillar_exact"],
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
  return v || "unknown";
}

function resolveDisplayMode(tokens, normalized) {
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

function resolveIntentType({
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

function resolvePlanKey({ intentType, targetPath, targetEntity }) {
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
  planKey,
  targetEntity,
  targetPath,
}) {
  if (planKey === "repo_status") {
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

  if (planKey === "repo_file" && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Какой именно файл или документ открыть?",
    };
  }

  if (planKey === "repo_search" && !targetEntity && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Что именно искать в репозитории?",
    };
  }

  if (planKey === "repo_analyze" && !targetPath) {
    return {
      needsClarification: true,
      clarificationQuestion: "Что именно нужно объяснить или перевести?",
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
  if (intentType === "find_target" && targetEntity) return "medium";
  if (intentType === "open_target" && targetPath) return "high";
  if (intentType === "explain_target" && (targetPath || targetEntity)) return "high";
  if (targetEntity) return "medium";
  return "low";
}

function resolveAnalyzeQuestion({ text, planKey }) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (planKey !== "repo_analyze") return "";
  return raw;
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