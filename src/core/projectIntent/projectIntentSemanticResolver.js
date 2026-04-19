// src/core/projectIntent/projectIntentSemanticResolver.js
// ============================================================================
// STAGE 12A.0 — semantic resolver for internal repo dialogue
// Purpose:
// - meaning-first
// - object-first where possible
// - minimize keyword reflex fallback
// - preserve universal repo object understanding
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
    .replace(/[.,!?;:()[\]{}<>\\|"\'`~@#$%^&*+=]+/g, " ")
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
  { entity: "decision", path: "pillars/DECISIONS.md" },
  { entity: "roadmap", path: "pillars/ROADMAP.md" },
  { entity: "project", path: "pillars/PROJECT.md" },
  { entity: "kingdom", path: "pillars/KINGDOM.md" },
  { entity: "sg_behavior", path: "pillars/SG_BEHAVIOR.md" },
  { entity: "sg_entity", path: "pillars/SG_ENTITY.md" },
  { entity: "repoindex", path: "pillars/REPOINDEX.md" },
  { entity: "code_insert_rules", path: "pillars/CODE_INSERT_RULES.md" },
  { entity: "readme", path: "README.md" },
  { entity: "project_description", path: "README.md" },
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
  "просмотр",
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
  "описан",
  "зачем",
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
  "корен",
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
  "ещ",
]);

const FIRST_PART_PREFIXES = Object.freeze([
  "перв",
  "част",
  "начал",
  "first",
  "part",
  "begin",
]);

const PRONOUN_FOLLOWUP_PREFIXES = Object.freeze([
  "он",
  "она",
  "оно",
  "это",
  "его",
  "её",
  "ее",
  "them",
  "it",
  "this",
  "that",
  "там",
  "тут",
  "этот",
  "эта",
  "это",
]);

const FOLDER_PREFIXES = Object.freeze([
  "папк",
  "директор",
  "каталог",
  "folder",
  "director",
  "dir",
]);

const FILE_PREFIXES = Object.freeze([
  "файл",
  "документ",
  "file",
  "doc",
]);

const LISTING_PREFIXES = Object.freeze([
  "спис",
  "содерж",
  "внутр",
  "внутри",
  "что",
  "какие",
  "list",
  "content",
  "inside",
  "покаж",
]);

const GENERIC_TARGET_WORDS = new Set([
  "файл",
  "файла",
  "файле",
  "файлы",
  "документ",
  "документа",
  "документе",
  "папка",
  "папку",
  "папке",
  "папки",
  "раздел",
  "раздела",
  "разделе",
  "репозиторий",
  "репозитории",
  "репо",
  "project",
  "repo",
  "file",
  "files",
  "folder",
  "directory",
  "document",
  "section",
  "contents",
  "content",
]);

function sanitizeTargetText(value) {
  return safeText(value)
    .replace(/^[`"'«“„]+/, "")
    .replace(/[`"'»”„]+$/, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}

function isLikelyPathOrFileToken(value) {
  const v = sanitizeTargetText(value);
  if (!v) return false;
  if (v.includes("/")) return true;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return true;
  if (/^[a-z0-9_.-]+$/i.test(v) && v.length >= 3) return true;
  return false;
}

function isLikelyBasename(value) {
  const v = sanitizeTargetText(value);
  return /\.[a-z0-9]{1,8}$/i.test(v) && !v.includes("/");
}

function looksLikeFolderTarget(value) {
  const v = sanitizeTargetText(value);
  if (!v) return false;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return false;
  return v.includes("/") || /^[A-Za-z0-9_.-]+$/.test(v);
}

function inferObjectKindFromTarget(value = "") {
  const v = sanitizeTargetText(value);
  if (!v) return "unknown";
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return "file";
  if (looksLikeFolderTarget(v)) return "folder";
  return "unknown";
}

function extractQuotedTargets(text = "") {
  const raw = safeText(text);
  const matches = [];

  const regexes = [
    /`([^`]{2,120})`/g,
    /"([^"]{2,120})"/g,
    /«([^»]{2,120})»/g,
  ];

  for (const rx of regexes) {
    let m;
    while ((m = rx.exec(raw)) !== null) {
      const candidate = sanitizeTargetText(m[1]);
      if (candidate) matches.push(candidate);
    }
  }

  return unique(matches);
}

function extractPathLikeTargets(text = "") {
  const raw = safeText(text);
  const matches = [];

  const rx = /\b([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\/?|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8})\b/g;
  let m;
  while ((m = rx.exec(raw)) !== null) {
    const candidate = sanitizeTargetText(m[1]);
    if (!candidate) continue;
    if (GENERIC_TARGET_WORDS.has(candidate.toLowerCase())) continue;
    if (candidate.length < 3) continue;
    if (isLikelyPathOrFileToken(candidate)) {
      matches.push(candidate);
    }
  }

  return unique(matches);
}

function extractNamedTargetByMarker(text = "") {
  const raw = safeText(text);

  const patterns = [
    /(?:файл|документ|раздел|папк[ауеи]?|директори[яиюе]?|каталог|file|document|section|folder|directory)\s+([A-Za-z0-9_.\-\/]{3,120})/i,
    /(?:про|about|inside)\s+([A-Za-z0-9_.\-\/]{3,120})/i,
    /(?:внутри|в)\s+([A-Za-z0-9_.\-\/]{3,120}\/?)/i,
  ];

  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const candidate = sanitizeTargetText(m[1]);
    if (!candidate) continue;
    if (GENERIC_TARGET_WORDS.has(candidate.toLowerCase())) continue;
    return candidate;
  }

  return "";
}

function inferSemanticAlias(text = "") {
  const normalized = normalizeText(text);

  if (
    (normalized.includes("описан") || normalized.includes("что это за проект") || normalized.includes("about project")) &&
    normalized.includes("проект")
  ) {
    return { entity: "project_description", path: "README.md", confidence: "high" };
  }

  if (normalized.includes("readme")) {
    return { entity: "readme", path: "README.md", confidence: "high" };
  }

  if (
    normalized.includes("decision") ||
    normalized.includes("decisions") ||
    normalized.includes("решени")
  ) {
    return { entity: "decisions", path: "pillars/DECISIONS.md", confidence: "medium" };
  }

  if (normalized.includes("workflow")) {
    return { entity: "workflow", path: "pillars/WORKFLOW.md", confidence: "high" };
  }

  if (normalized.includes("roadmap")) {
    return { entity: "roadmap", path: "pillars/ROADMAP.md", confidence: "high" };
  }

  if (normalized.includes("project.md")) {
    return { entity: "project", path: "pillars/PROJECT.md", confidence: "high" };
  }

  return { entity: "", path: "", confidence: "low" };
}

function fuzzyCanonicalMatch(text = "") {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const alias = inferSemanticAlias(normalized);
  if (alias.path) {
    return alias;
  }

  const candidates = [];

  for (const token of tokens) {
    const clean = token.replace(/[^a-zа-я0-9_./-]/gi, "");
    if (!clean || clean.length < 3) continue;

    for (const item of KNOWN_CANONICAL_TARGETS) {
      const dist = levenshtein(clean, item.entity);
      if (dist <= 2 || item.entity.includes(clean) || clean.includes(item.entity)) {
        candidates.push({
          ...item,
          score: dist,
        });
      }

      const fileBase = item.path.split("/").pop()?.replace(/\.[^.]+$/i, "").toLowerCase() || "";
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

function extractTargetPhrase(text = "") {
  const quoted = extractQuotedTargets(text);
  if (quoted.length > 0) return quoted[0];

  const named = extractNamedTargetByMarker(text);
  if (named) return named;

  const pathLike = extractPathLikeTargets(text);
  if (pathLike.length > 0) return pathLike[0];

  return "";
}

function extractTreePrefix(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return "";

  if (
    normalized.includes("корне") ||
    normalized.includes("в корне") ||
    normalized.includes("root")
  ) {
    return "";
  }

  const pathLike = extractPathLikeTargets(text);
  for (const item of pathLike) {
    if (item.includes("/") || /^[A-Za-z0-9_.-]+$/.test(item)) {
      return sanitizeTargetText(item).replace(/^\//, "");
    }
  }

  const m = safeText(text).match(/(?:покажи|раскрой|открой|show|open)\s+([A-Za-z0-9_.\-\/]{2,120}\/?)/i);
  if (m?.[1]) {
    return sanitizeTargetText(m[1]).replace(/^\//, "");
  }

  return "";
}

function normalizeFolderTarget(target = "") {
  const v = sanitizeTargetText(target).replace(/^\//, "");
  if (!v) return "";
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return v;
  return v.endsWith("/") ? v : `${v}/`;
}

function detectActionMeaning({ normalized, tokens, followupContext, pendingChoiceContext }) {
  const searchHits = collectPrefixHits(tokens, SEARCH_PREFIXES);
  const openHits = collectPrefixHits(tokens, OPEN_PREFIXES);
  const explainHits = collectPrefixHits(tokens, EXPLAIN_PREFIXES);
  const translateHits = collectPrefixHits(tokens, TRANSLATE_PREFIXES);
  const summaryHits = collectPrefixHits(tokens, SUMMARY_PREFIXES);
  const treeHits = collectPrefixHits(tokens, TREE_PREFIXES);
  const statusHits = collectPrefixHits(tokens, STATUS_PREFIXES);
  const continueHits = collectPrefixHits(tokens, CONTINUE_PREFIXES);
  const firstPartHits = collectPrefixHits(tokens, FIRST_PART_PREFIXES);
  const folderHits = collectPrefixHits(tokens, FOLDER_PREFIXES);
  const fileHits = collectPrefixHits(tokens, FILE_PREFIXES);
  const listingHits = collectPrefixHits(tokens, LISTING_PREFIXES);
  const pronounHits = collectPrefixHits(tokens, PRONOUN_FOLLOWUP_PREFIXES);

  const wantsContinuation =
    continueHits.length > 0 ||
    normalized.includes("следующ") ||
    normalized.includes("ещё") ||
    normalized.includes("еще") ||
    normalized.includes("дальше");

  const wantsTree =
    treeHits.length > 0 ||
    normalized.includes("дерево репозитория") ||
    normalized.includes("какие папки в корне");

  const wantsStatus =
    (statusHits.length > 0 && normalized.includes("репозитор")) ||
    normalized.includes("видишь репозиторий") ||
    normalized.includes("есть доступ к репозиторию");

  const wantsSummary = summaryHits.length > 0 || normalized.includes("кратко");
  const wantsTranslate = translateHits.length > 0 || normalized.includes("на русском") || normalized.includes("по-русски");
  const wantsExplain =
    explainHits.length > 0 ||
    normalized.includes("о чем") ||
    normalized.includes("о чём") ||
    normalized.includes("что это за файл") ||
    normalized.includes("в чем смысл") ||
    normalized.includes("зачем он");

  const wantsOpen = openHits.length > 0;
  const wantsSearch = searchHits.length > 0;
  const wantsFolderListing =
    folderHits.length > 0 ||
    listingHits.length > 0 ||
    normalized.includes("что внутри") ||
    normalized.includes("содержимое папки") ||
    normalized.includes("inside folder") ||
    normalized.includes("contents");

  const wantsFirstPart =
    firstPartHits.length > 0 && normalized.includes("част");

  if (followupContext?.continuation?.isActive === true && wantsContinuation) {
    return {
      intent: "continue_active",
      confidence: "high",
    };
  }

  if (pendingChoiceContext?.isActive === true && (wantsSummary || wantsExplain || wantsTranslate || wantsFirstPart || wantsContinuation)) {
    return {
      intent: "answer_pending_choice",
      confidence: "high",
    };
  }

  if (wantsTree) {
    return {
      intent: "show_tree",
      confidence: "medium",
    };
  }

  if (wantsStatus) {
    return {
      intent: "repo_status",
      confidence: "medium",
    };
  }

  if (wantsFolderListing) {
    return {
      intent: "browse_folder",
      confidence: "medium",
    };
  }

  if (wantsSearch && (wantsExplain || wantsSummary || wantsTranslate)) {
    return {
      intent: "find_and_explain",
      confidence: "medium",
    };
  }

  if (wantsSearch) {
    return {
      intent: "find_target",
      confidence: "medium",
    };
  }

  if (wantsExplain || wantsTranslate || wantsSummary || wantsFirstPart) {
    return {
      intent: "explain_target",
      confidence: "medium",
    };
  }

  if (wantsOpen) {
    return {
      intent: "open_target",
      confidence: "medium",
    };
  }

  if (
    followupContext?.isActive === true &&
    pronounHits.length > 0 &&
    (wantsExplain || wantsSummary || wantsTranslate || wantsOpen)
  ) {
    return {
      intent: "explain_active",
      confidence: "medium",
    };
  }

  return {
    intent: "unknown",
    confidence: "low",
  };
}

function heuristicFallback({
  text,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const fuzzy = fuzzyCanonicalMatch(text);
  const extractedTarget = extractTargetPhrase(text);
  const treePrefix = extractTreePrefix(text);

  const targetEntity = pickFirstNonEmpty([
    extractedTarget,
    fuzzy.entity,
    followupContext?.targetEntity,
    pendingChoiceContext?.targetEntity,
  ]);

  const targetPath = pickFirstNonEmpty([
    isLikelyPathOrFileToken(extractedTarget) ? extractedTarget : "",
    fuzzy.path,
    followupContext?.targetPath,
    pendingChoiceContext?.targetPath,
  ]);

  const actionMeaning = detectActionMeaning({
    normalized,
    tokens,
    followupContext,
    pendingChoiceContext,
  });

  let displayMode = "raw";
  if (normalized.includes("на русском") || normalized.includes("по-русски")) {
    displayMode = "translate_ru";
  } else if (normalized.includes("кратко")) {
    displayMode = "summary";
  } else if (
    normalized.includes("объяс") ||
    normalized.includes("о чем") ||
    normalized.includes("о чём") ||
    normalized.includes("смысл")
  ) {
    displayMode = "explain";
  }

  if (normalized.includes("первая часть") || normalized.includes("покажи первую часть")) {
    displayMode = "raw_first_part";
  }

  const inferredObjectKind = inferObjectKindFromTarget(
    pickFirstNonEmpty([
      extractedTarget,
      targetPath,
      followupContext?.targetPath,
      followupContext?.targetEntity,
    ])
  );

  if (actionMeaning.intent === "continue_active") {
    return {
      intent: "continue_active",
      targetEntity: safeText(followupContext?.targetEntity),
      targetPath: safeText(followupContext?.continuation?.targetPath || followupContext?.targetPath),
      displayMode: safeText(followupContext?.continuation?.displayMode || followupContext?.displayMode || "explain"),
      treePrefix: safeText(followupContext?.treePrefix),
      objectKind: safeText(followupContext?.objectKind || inferredObjectKind),
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
    };
  }

  if (actionMeaning.intent === "answer_pending_choice") {
    return {
      intent: "answer_pending_choice",
      targetEntity,
      targetPath,
      displayMode:
        displayMode === "raw"
          ? safeText(pendingChoiceContext?.displayMode || "summary")
          : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
    };
  }

  if (actionMeaning.intent === "show_tree") {
    return {
      intent: "show_tree",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix,
      objectKind: treePrefix ? "folder" : "root",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: actionMeaning.confidence,
    };
  }

  if (actionMeaning.intent === "repo_status") {
    return {
      intent: "repo_status",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix: "",
      objectKind: "repo",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: actionMeaning.confidence,
    };
  }

  if (actionMeaning.intent === "browse_folder") {
    const folderTarget = normalizeFolderTarget(
      extractedTarget || targetPath || targetEntity || treePrefix || followupContext?.targetPath || followupContext?.treePrefix
    );

    return {
      intent: "browse_folder",
      targetEntity: safeText(extractedTarget || targetEntity || folderTarget),
      targetPath: folderTarget,
      displayMode: "raw",
      treePrefix: folderTarget,
      objectKind: folderTarget ? "folder" : "unknown",
      clarifyNeeded: !folderTarget,
      clarifyQuestion: folderTarget ? "" : "Какую именно папку показать?",
      confidence: folderTarget ? "high" : "medium",
    };
  }

  if (actionMeaning.intent === "find_and_explain") {
    return {
      intent: "find_and_explain",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "summary" : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать и объяснить в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "find_target") {
    return {
      intent: "find_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "open_target") {
    return {
      intent: "open_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetPath && !targetEntity,
      clarifyQuestion: (!targetPath && !targetEntity) ? "Какой именно файл или документ открыть?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "explain_active") {
    return {
      intent: "explain_active",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? (safeText(followupContext?.displayMode) || "explain") : displayMode,
      treePrefix: "",
      objectKind: safeText(followupContext?.objectKind || inferObjectKindFromTarget(targetPath || targetEntity)),
      clarifyNeeded: !targetPath && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetPath || followupContext?.isActive) ? "high" : "medium",
    };
  }

  if (actionMeaning.intent === "explain_target") {
    return {
      intent: "explain_target",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "explain" : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetPath && !targetEntity && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !targetEntity && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetEntity || targetPath || followupContext?.isActive) ? "high" : "low",
    };
  }

  return {
    intent: "unknown",
    targetEntity,
    targetPath,
    displayMode,
    treePrefix: "",
    objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
    clarifyNeeded: false,
    clarifyQuestion: "",
    confidence: targetEntity || targetPath ? "medium" : "low",
  };
}

function sanitizeSemanticResult(raw, fallback) {
  const result = raw && typeof raw === "object" ? raw : {};

  const allowedIntents = new Set([
    "repo_status",
    "show_tree",
    "browse_folder",
    "find_target",
    "find_and_explain",
    "open_target",
    "explain_target",
    "explain_active",
    "answer_pending_choice",
    "continue_active",
    "unknown",
  ]);

  const allowedDisplayModes = new Set([
    "raw",
    "raw_first_part",
    "summary",
    "explain",
    "translate_ru",
  ]);

  const allowedConfidence = new Set([
    "low",
    "medium",
    "high",
  ]);

  const allowedObjectKinds = new Set([
    "repo",
    "root",
    "folder",
    "file",
    "unknown",
  ]);

  const intent = allowedIntents.has(result.intent)
    ? result.intent
    : fallback.intent;

  return {
    intent,
    targetEntity: safeText(result.targetEntity || fallback.targetEntity),
    targetPath: safeText(result.targetPath || fallback.targetPath),
    displayMode: allowedDisplayModes.has(safeText(result.displayMode))
      ? safeText(result.displayMode)
      : safeText(fallback.displayMode || "raw"),
    treePrefix: safeText(result.treePrefix || fallback.treePrefix || ""),
    objectKind: allowedObjectKinds.has(safeText(result.objectKind))
      ? safeText(result.objectKind)
      : safeText(fallback.objectKind || "unknown"),
    clarifyNeeded: result.clarifyNeeded === true ? true : fallback.clarifyNeeded === true,
    clarifyQuestion: safeText(result.clarifyQuestion || fallback.clarifyQuestion),
    confidence: allowedConfidence.has(safeText(result.confidence))
      ? safeText(result.confidence)
      : safeText(fallback.confidence || "low"),
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
    `active_repo_action_kind: ${safeText(followupContext?.actionKind)}`,
    `active_repo_object_kind: ${safeText(followupContext?.objectKind)}`,
    `active_repo_continuation: ${followupContext?.continuation?.isActive === true ? "yes" : "no"}`,
    `active_repo_continuation_target_path: ${safeText(followupContext?.continuation?.targetPath)}`,
    `active_repo_continuation_display_mode: ${safeText(followupContext?.continuation?.displayMode)}`,
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
        "Task: understand USER MEANING, not command words.\n" +
        "Return ONLY strict JSON.\n" +
        "Do not explain.\n" +
        "Do not hallucinate files.\n" +
        "Prefer active repo context and pending choice context.\n" +
        "Prefer object understanding: repo root, folder, file, continuation.\n" +
        "If active repo continuation exists and user asks to continue, use continue_active.\n" +
        "If active repo action is browse_folder and user mentions a basename like DOCS_GOVERNANCE.md, treat it as a file inside that active folder.\n" +
        "If user asks what is inside a folder, prefer browse_folder.\n" +
        "If user asks what a file is about, prefer explain_target.\n" +
        "If user asks to show repository tree, default to root-first.\n" +
        "JSON shape:\n" +
        "{\n" +
        '  "intent": "repo_status|show_tree|browse_folder|find_target|find_and_explain|open_target|explain_target|explain_active|answer_pending_choice|continue_active|unknown",\n' +
        '  "targetEntity": "string",\n' +
        '  "targetPath": "string",\n' +
        '  "displayMode": "raw|raw_first_part|summary|explain|translate_ru",\n' +
        '  "treePrefix": "string",\n' +
        '  "objectKind": "repo|root|folder|file|unknown",\n' +
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
        max_completion_tokens: 260,
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
