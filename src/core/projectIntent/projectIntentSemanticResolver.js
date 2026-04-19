// src/core/projectIntent/projectIntentSemanticResolver.js
// ============================================================================
// STAGE 12A.0 — semantic resolver for internal repo dialogue
// Purpose:
// - parse HUMAN meaning first using AI
// - avoid binding live dialogue to raw command words
// - support active repo context + pending choice context
// IMPORTANT:
// - READ-ONLY only
// - NO repo writes
// - no direct handler execution here
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'`~@#$%^&*+=/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    const v = safeText(value);
    if (v) return v;
  }
  return "";
}

function levenshtein(a, b) {
  const s = safeText(a).toLowerCase();
  const t = safeText(b).toLowerCase();

  if (!s) return t.length;
  if (!t) return s.length;

  const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));

  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[s.length][t.length];
}

const KNOWN_CANONICAL_TARGETS = Object.freeze([
  { entity: "workflow", path: "pillars/WORKFLOW.md" },
  { entity: "decisions", path: "pillars/DECISIONS.md" },
  { entity: "roadmap", path: "pillars/ROADMAP.md" },
  { entity: "project", path: "pillars/PROJECT.md" },
  { entity: "kingdom", path: "pillars/KINGDOM.md" },
  { entity: "sg_behavior", path: "pillars/SG_BEHAVIOR.md" },
  { entity: "sg_entity", path: "pillars/SG_ENTITY.md" },
  { entity: "repoindex", path: "pillars/REPOINDEX.md" },
  { entity: "code_insert_rules", path: "pillars/CODE_INSERT_RULES.md" },
]);

const SEARCH_PREFIXES = Object.freeze([
  "найд",
  "ищ",
  "поиск",
  "find",
  "search",
  "locat",
  "where",
]);

const OPEN_PREFIXES = Object.freeze([
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
  "смысл",
  "разбор",
  "проанализ",
  "анализ",
  "explain",
  "analy",
  "review",
  "inspect",
]);

const TRANSLATE_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "англ",
  "translate",
]);

const SUMMARY_PREFIXES = Object.freeze([
  "общ",
  "кратк",
  "коротк",
  "прост",
  "summary",
  "brief",
  "short",
  "simple",
]);

const TREE_PREFIXES = Object.freeze([
  "дерев",
  "структур",
  "ветк",
  "tree",
  "root",
]);

const STATUS_PREFIXES = Object.freeze([
  "доступ",
  "стат",
  "состоя",
  "status",
  "access",
  "connected",
]);

const CONTINUE_PREFIXES = Object.freeze([
  "дальш",
  "продол",
  "continue",
  "next",
]);

function fuzzyCanonicalMatch(text = "") {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const candidates = [];

  for (const token of tokens) {
    const clean = token.replace(/[^a-zа-я0-9_]/gi, "");
    if (!clean || clean.length < 3) continue;

    for (const item of KNOWN_CANONICAL_TARGETS) {
      const dist = levenshtein(clean, item.entity);
      if (dist <= 2 || item.entity.includes(clean) || clean.includes(item.entity)) {
        candidates.push({
          ...item,
          score: dist,
        });
      }

      const fileBase = item.path.split("/").pop()?.replace(/\.md$/i, "").toLowerCase() || "";
      const fileDist = levenshtein(clean, fileBase);
      if (fileDist <= 2 || fileBase.includes(clean) || clean.includes(fileBase)) {
        candidates.push({
          ...item,
          score: Math.min(dist, fileDist),
        });
      }
    }
  }

  if (!candidates.length) {
    return {
      entity: "",
      path: "",
      confidence: "low",
    };
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  return {
    entity: safeText(best.entity),
    path: safeText(best.path),
    confidence: best.score === 0 ? "high" : "medium",
  };
}

function heuristicFallback({
  text,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const searchHits = collectPrefixHits(tokens, SEARCH_PREFIXES);
  const openHits = collectPrefixHits(tokens, OPEN_PREFIXES);
  const explainHits = collectPrefixHits(tokens, EXPLAIN_PREFIXES);
  const translateHits = collectPrefixHits(tokens, TRANSLATE_PREFIXES);
  const summaryHits = collectPrefixHits(tokens, SUMMARY_PREFIXES);
  const treeHits = collectPrefixHits(tokens, TREE_PREFIXES);
  const statusHits = collectPrefixHits(tokens, STATUS_PREFIXES);
  const continueHits = collectPrefixHits(tokens, CONTINUE_PREFIXES);

  const fuzzy = fuzzyCanonicalMatch(text);

  const targetEntity = pickFirstNonEmpty([
    fuzzy.entity,
    followupContext?.targetEntity,
    pendingChoiceContext?.targetEntity,
  ]);

  const targetPath = pickFirstNonEmpty([
    fuzzy.path,
    followupContext?.targetPath,
    pendingChoiceContext?.targetPath,
  ]);

  let displayMode = "raw";
  if (normalized.includes("на русском") || normalized.includes("по-русски") || translateHits.length > 0) {
    displayMode = "translate_ru";
  } else if (summaryHits.length > 0) {
    displayMode = "summary";
  } else if (explainHits.length > 0) {
    displayMode = "explain";
  }

  if (pendingChoiceContext?.isActive) {
    if (summaryHits.length > 0) {
      return {
        intent: "answer_pending_choice",
        targetEntity,
        targetPath,
        displayMode: "summary",
        treePrefix: "",
        clarifyNeeded: false,
        clarifyQuestion: "",
        confidence: "medium",
      };
    }

    if (explainHits.length > 0 || translateHits.length > 0) {
      return {
        intent: "answer_pending_choice",
        targetEntity,
        targetPath,
        displayMode,
        treePrefix: "",
        clarifyNeeded: false,
        clarifyQuestion: "",
        confidence: "medium",
      };
    }

    if (continueHits.length > 0) {
      return {
        intent: "answer_pending_choice",
        targetEntity,
        targetPath,
        displayMode: safeText(pendingChoiceContext?.displayMode) || "summary",
        treePrefix: "",
        clarifyNeeded: false,
        clarifyQuestion: "",
        confidence: "medium",
      };
    }
  }

  if (treeHits.length > 0) {
    return {
      intent: "show_tree",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix: "",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "medium",
    };
  }

  if (statusHits.length > 0 && normalized.includes("репозитор")) {
    return {
      intent: "repo_status",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix: "",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "medium",
    };
  }

  if (followupContext?.isActive && (explainHits.length > 0 || translateHits.length > 0 || summaryHits.length > 0 || continueHits.length > 0)) {
    return {
      intent: "explain_active",
      targetEntity,
      targetPath,
      displayMode,
      treePrefix: "",
      clarifyNeeded: !targetPath,
      clarifyQuestion: targetPath ? "" : "Что именно из последнего результата нужно объяснить?",
      confidence: targetPath ? "medium" : "low",
    };
  }

  if (searchHits.length > 0 && (explainHits.length > 0 || translateHits.length > 0 || summaryHits.length > 0)) {
    return {
      intent: "find_and_explain",
      targetEntity,
      targetPath,
      displayMode,
      treePrefix: "",
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать и объяснить в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "medium" : "low",
    };
  }

  if (searchHits.length > 0) {
    return {
      intent: "find_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "medium" : "low",
    };
  }

  if (openHits.length > 0) {
    return {
      intent: "open_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      clarifyNeeded: !targetPath && !targetEntity,
      clarifyQuestion: (!targetPath && !targetEntity) ? "Какой именно файл или документ открыть?" : "",
      confidence: (targetEntity || targetPath) ? "medium" : "low",
    };
  }

  if (explainHits.length > 0 || translateHits.length > 0 || summaryHits.length > 0) {
    return {
      intent: "explain_target",
      targetEntity,
      targetPath,
      displayMode,
      treePrefix: "",
      clarifyNeeded: !targetPath && !targetEntity,
      clarifyQuestion: (!targetPath && !targetEntity) ? "Что именно нужно объяснить?" : "",
      confidence: (targetEntity || targetPath || followupContext?.isActive) ? "medium" : "low",
    };
  }

  return {
    intent: "unknown",
    targetEntity,
    targetPath,
    displayMode,
    treePrefix: "",
    clarifyNeeded: false,
    clarifyQuestion: "",
    confidence: "low",
  };
}

function sanitizeSemanticResult(raw, fallback) {
  const result = raw && typeof raw === "object" ? raw : {};

  const allowedIntents = new Set([
    "repo_status",
    "show_tree",
    "find_target",
    "find_and_explain",
    "open_target",
    "explain_target",
    "explain_active",
    "answer_pending_choice",
    "unknown",
  ]);

  const intent = allowedIntents.has(result.intent)
    ? result.intent
    : fallback.intent;

  return {
    intent,
    targetEntity: safeText(result.targetEntity || fallback.targetEntity),
    targetPath: safeText(result.targetPath || fallback.targetPath),
    displayMode: safeText(result.displayMode || fallback.displayMode || "raw"),
    treePrefix: safeText(result.treePrefix || ""),
    clarifyNeeded: result.clarifyNeeded === true ? true : fallback.clarifyNeeded === true,
    clarifyQuestion: safeText(result.clarifyQuestion || fallback.clarifyQuestion),
    confidence: safeText(result.confidence || fallback.confidence || "low"),
  };
}

function buildSemanticMessages({
  text,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const contextLines = [
    `current_user_message: ${safeText(text)}`,
    `active_repo_context: ${followupContext?.isActive === true ? "yes" : "no"}`,
    `active_repo_target_entity: ${safeText(followupContext?.targetEntity)}`,
    `active_repo_target_path: ${safeText(followupContext?.targetPath)}`,
    `active_repo_display_mode: ${safeText(followupContext?.displayMode)}`,
    `pending_choice_active: ${pendingChoiceContext?.isActive === true ? "yes" : "no"}`,
    `pending_choice_target_entity: ${safeText(pendingChoiceContext?.targetEntity)}`,
    `pending_choice_target_path: ${safeText(pendingChoiceContext?.targetPath)}`,
    `pending_choice_display_mode: ${safeText(pendingChoiceContext?.displayMode)}`,
  ].join("\n");

  return [
    {
      role: "system",
      content:
        "You are a semantic parser for INTERNAL REPO DIALOGUE.\n" +
        "Task: understand USER MEANING, not commands.\n" +
        "The user speaks naturally.\n" +
        "Return ONLY strict JSON.\n" +
        "Do not explain.\n" +
        "Do not hallucinate files.\n" +
        "Prefer active repo context and pending choice context over reopening raw files.\n" +
        "If user replies to a previous question like 'общую информацию', 'простыми словами', 'первую часть', this is answer_pending_choice, not a new unrelated topic.\n" +
        "If user asks to show repository tree, default to root level first.\n" +
        "JSON shape:\n" +
        "{\n" +
        '  "intent": "repo_status|show_tree|find_target|find_and_explain|open_target|explain_target|explain_active|answer_pending_choice|unknown",\n' +
        '  "targetEntity": "string",\n' +
        '  "targetPath": "string",\n' +
        '  "displayMode": "raw|summary|explain|translate_ru",\n' +
        '  "treePrefix": "string",\n' +
        '  "clarifyNeeded": true,\n' +
        '  "clarifyQuestion": "string",\n' +
        '  "confidence": "low|medium|high"\n' +
        "}",
    },
    {
      role: "user",
      content: contextLines,
    },
  ];
}

export async function resolveProjectIntentSemanticPlan({
  text,
  callAI,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const fallback = heuristicFallback({
    text,
    followupContext,
    pendingChoiceContext,
  });

  if (typeof callAI !== "function") {
    return fallback;
  }

  try {
    const aiReply = await callAI(
      buildSemanticMessages({
        text,
        followupContext,
        pendingChoiceContext,
      }),
      "high",
      {
        max_completion_tokens: 220,
        temperature: 0.1,
      }
    );

    const parsed = safeJsonParse(aiReply);
    return sanitizeSemanticResult(parsed, fallback);
  } catch {
    return fallback;
  }
}

export default {
  resolveProjectIntentSemanticPlan,
};