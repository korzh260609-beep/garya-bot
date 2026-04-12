// ============================================================================
// === src/bot/handlers/stage-check/signals.js
// ============================================================================

import { uniq, normalizeItemCode } from "./common.js";
import { getAncestorChain } from "./workflowParser.js";

export function buildConfig(rulesJson) {
  const cfg = rulesJson?.engine || {};

  return {
    maxChecksPerItem: Number(cfg.max_checks_per_item || 8),
    minIdentifierLength: Number(cfg.min_identifier_length || 3),
    maxSearchFilesPerToken: Number(cfg.max_search_files_per_token || 300),
    maxInheritedSignals: Number(cfg.max_inherited_signals || 6),
    maxDescendantSignals: Number(cfg.max_descendant_signals || 4),
    maxFileFetchesPerCommand: Number(cfg.max_file_fetches_per_command || 120),
    preferredPathPrefixes: Array.isArray(cfg.preferred_path_prefixes)
      ? cfg.preferred_path_prefixes.map((x) => String(x || ""))
      : [],
    searchableExtensions: Array.isArray(cfg.searchable_extensions)
      ? cfg.searchable_extensions.map((x) => String(x || "").toLowerCase())
      : [".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".txt", ".yaml", ".yml"],
    stopTokens: new Set(
      Array.isArray(cfg.stop_tokens)
        ? cfg.stop_tokens.map((x) => String(x || "").toLowerCase()).filter(Boolean)
        : []
    ),
    uppercaseAcronymAllowlist: new Set(
      Array.isArray(cfg.uppercase_acronym_allowlist)
        ? cfg.uppercase_acronym_allowlist.map((x) => String(x || "").toLowerCase()).filter(Boolean)
        : ["api", "rss", "jwt", "ocr", "tts", "sbt", "dao", "rpc", "dlq"]
    ),
    basenameSignalSuffixes: Array.isArray(cfg.basename_signal_suffixes)
      ? cfg.basename_signal_suffixes.map((x) => String(x || ""))
      : [
          "Service",
          "Source",
          "Repo",
          "Store",
          "Adapter",
          "Router",
          "Handler",
          "Loader",
          "Manager",
          "Provider",
          "Registry",
          "Bridge",
          "Client",
          "Controller",
          "Engine",
          "Guard",
          "Policy",
        ],
    basenameBlocklist: new Set(
      Array.isArray(cfg.basename_blocklist)
        ? cfg.basename_blocklist.map((x) => String(x || "").toLowerCase()).filter(Boolean)
        : []
    ),
    genericUppercaseWords: new Set(
      Array.isArray(cfg.generic_uppercase_words)
        ? cfg.generic_uppercase_words.map((x) => String(x || "").toLowerCase()).filter(Boolean)
        : []
    ),
    allowPascalCaseBasenameSignals:
      cfg.allow_pascal_case_basename_signals !== false,
    minPascalCaseBasenameLength: Number(
      cfg.min_pascal_case_basename_length || 6
    ),
    clusterMaxTokens: Number(cfg.cluster_max_tokens || 8),
    clusterMinMatchedTokens: Number(cfg.cluster_min_matched_tokens || 2),
    clusterMinDistinctFiles: Number(cfg.cluster_min_distinct_files || 2),
    clusterStrongMatchedTokens: Number(cfg.cluster_strong_matched_tokens || 3),
    clusterStrongDistinctFiles: Number(cfg.cluster_strong_distinct_files || 2),
  };
}

export function hasAllowedExtension(path, config) {
  const lower = String(path || "").toLowerCase();
  return config.searchableExtensions.some((ext) => lower.endsWith(ext));
}

export function sortSearchPaths(paths, config) {
  const prefixes = Array.isArray(config.preferredPathPrefixes)
    ? config.preferredPathPrefixes
    : [];

  const scorePath = (path) => {
    for (let i = 0; i < prefixes.length; i += 1) {
      if (path.startsWith(prefixes[i])) return i;
    }
    return prefixes.length + 100;
  };

  return [...paths].sort((a, b) => {
    const sa = scorePath(a);
    const sb = scorePath(b);
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
}

export function extractExplicitPaths(text) {
  const matches = String(text || "").match(
    /\b(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+\b/g
  );
  return uniq(matches || []);
}

export function extractCommands(text) {
  const matches = String(text || "").match(/\/[a-z][a-z0-9_]+/gi);
  return uniq((matches || []).map((x) => x.toLowerCase()));
}

export function extractBackticked(text) {
  const matches = [];
  const re = /`([^`]+)`/g;
  let hit;

  while ((hit = re.exec(String(text || "")))) {
    const value = String(hit[1] || "").trim();
    if (value) matches.push(value);
  }

  return uniq(matches);
}

export function extractSlashListItems(text) {
  const out = [];
  const source = String(text || "");

  const patterns =
    source.match(/\b[A-Za-z][A-Za-z0-9_-]*(?:\/[A-Za-z][A-Za-z0-9_-]*){1,}\b/g) || [];

  for (const entry of patterns) {
    const parts = entry
      .split("/")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const part of parts) out.push(part);
    out.push(entry);
  }

  return uniq(out);
}

function extractFunctionLikeTokens(text) {
  const source = String(text || "");
  const out = [];

  const functionPatterns = [
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)/g,
  ];

  for (const re of functionPatterns) {
    let hit;
    while ((hit = re.exec(source))) {
      const fnName = String(hit[1] || "").trim();
      const argsRaw = String(hit[2] || "").trim();

      if (fnName) out.push(fnName);
      if (fnName) out.push(`${fnName}(`);

      if (fnName && argsRaw) {
        out.push(`${fnName}(${argsRaw})`);
      }

      const args = argsRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      for (const arg of args) {
        out.push(arg);
      }

      if (fnName && args.length >= 1) {
        out.push(`${fnName}(${args[0]}`);
      }

      if (fnName && args.length >= 2) {
        out.push(`${fnName}(${args[0]}, ${args[1]})`);
      }
    }
  }

  return uniq(out);
}

function isAllUppercaseWord(token) {
  return /^[A-Z][A-Z0-9_-]+$/.test(String(token || ""));
}

function isAllowedUppercaseAcronym(token, config) {
  const raw = String(token || "").trim();
  if (!raw || !isAllUppercaseWord(raw) || raw.includes("_")) return false;
  return config.uppercaseAcronymAllowlist.has(raw.toLowerCase());
}

function isWeakGenericToken(token) {
  const lower = String(token || "").trim().toLowerCase();
  return new Set([
    "context",
    "contexts",
    "read",
    "write",
    "recent",
    "run",
    "fail",
    "ack",
    "enqueue",
    "user",
    "users",
    "action",
    "actions",
    "access",
    "permission",
    "permissions",
    "denied",
    "allowed",
    "interface",
    "interfaces",
    "contract",
    "contracts",
    "minimal",
    "minimals",
  ]).has(lower);
}

export function isUsefulToken(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (config.stopTokens.has(lower)) return false;
  if (config.basenameBlocklist.has(lower)) return false;
  if (config.genericUppercaseWords.has(lower)) return false;

  if (
    !raw.endsWith("(") &&
    !raw.includes("(") &&
    lower.length < config.minIdentifierLength
  ) {
    return false;
  }

  if (/^[0-9.]+$/.test(lower)) return false;
  if (/^[a-z]$/.test(lower)) return false;
  if (/^[ivxlcdm]+$/i.test(lower)) return false;

  if (isAllUppercaseWord(raw) && !raw.includes("_")) {
    return isAllowedUppercaseAcronym(raw, config);
  }

  return true;
}

function splitPhraseWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[`"'()[\]{}:;,.!?]/g, " ")
    .replace(/[\/\\]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function toPascalCase(words) {
  return words
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "")
    .join("");
}

function addMorphVariants(base, add) {
  const lower = String(base || "").toLowerCase();
  if (!lower) return;

  add(lower);

  if (lower.endsWith("ies") && lower.length > 4) {
    add(lower.slice(0, -3) + "y");
  }

  if (lower.endsWith("s") && lower.length > 3) {
    add(lower.slice(0, -1));
  } else {
    add(`${lower}s`);
  }

  if (lower.endsWith("ed") && lower.length > 4) {
    add(lower.slice(0, -2));
  }

  if (lower.endsWith("ing") && lower.length > 5) {
    add(lower.slice(0, -3));
  }
}

function addDelimiterVariants(parts, add) {
  const tokens = parts.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return;

  add(tokens.join("_"));
  add(tokens.join("-"));
  add(tokens.join(""));
  add(tokens.join(" "));
  add(toPascalCase(tokens));
}

function addConceptFamilies(token, add) {
  const lower = String(token || "").toLowerCase();
  if (!lower) return;

  if (lower === "retry" || lower === "retries" || lower === "retried" || lower === "retrying") {
    [
      "retry",
      "retries",
      "retry_policy",
      "max_retries",
      "retry_count",
      "retry_at",
      "next_retry_at",
      "backoff",
      "jitter",
      "retryable",
      "retried_at",
      "computeBackoffDelayMs",
      "shouldRetry",
      "getRetryPolicy",
      "maxRetries",
      "baseDelayMs",
      "maxDelayMs",
      "jitterRatio",
    ].forEach(add);
  }

  if (
    lower === "fail" ||
    lower === "failed" ||
    lower === "failure" ||
    lower === "failures" ||
    lower === "failing"
  ) {
    [
      "fail",
      "failed",
      "failure",
      "failures",
      "fail_reason",
      "fail_reasons",
      "fail_code",
      "failure_reason",
      "error_reason",
      "failed_at",
      "last_error_at",
      "error_code",
      "markTaskRunFailed",
      "normalizeFailCode",
    ].forEach(add);
  }

  if (lower === "reason" || lower === "reasons") {
    [
      "reason",
      "reasons",
      "fail_reason",
      "fail_reasons",
      "failure_reason",
      "error_reason",
    ].forEach(add);
  }

  if (lower === "error" || lower === "errors") {
    [
      "error",
      "errors",
      "error_code",
      "last_error_at",
      "failure_reason",
      "fail_reason",
      "fail_code",
    ].forEach(add);
  }

  if (lower === "permission" || lower === "permissions") {
    [
      "permission",
      "permissions",
      "allowed",
      "denied",
      "access",
      "can",
      "can(",
      "permission_denied",
    ].forEach(add);
  }

  if (lower === "access") {
    [
      "access",
      "allowed",
      "denied",
      "permission",
      "permissions",
      "can",
      "can(",
    ].forEach(add);
  }

  if (lower === "can") {
    [
      "can",
      "can(",
      "allowed",
      "denied",
      "permission",
      "permissions",
      "access",
    ].forEach(add);
  }

  if (lower === "enqueue" || lower === "run" || lower === "ack" || lower === "fail") {
    [
      "enqueue",
      "run",
      "ack",
      "fail",
      "JobRunner",
      "enqueue(",
      "run(",
      "ack(",
      "fail(",
    ].forEach(add);
  }

  if (lower === "write" || lower === "read" || lower === "context" || lower === "recent") {
    [
      "write",
      "read",
      "context",
      "recent",
      "write(",
      "read(",
      "context(",
      "recent(",
    ].forEach(add);
  }

  if (lower === "dlq") {
    [
      "dlq",
      "dlqs",
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "dead_letter_queue_enabled",
      "move_to_dlq",
      "moveToDlq",
      "dlq_jobs",
      "DlqRepo",
      "JOB_DLQ_ENABLED",
      "_moveToDLQ",
      "getDLQ",
      "enableDLQ",
      "_dlqEnabled",
    ].forEach(add);
  }

  if (lower === "dead" || lower === "letter" || lower === "queue") {
    [
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "dlq",
      "dlq_jobs",
      "move_to_dlq",
      "moveToDlq",
      "DlqRepo",
      "_moveToDLQ",
    ].forEach(add);
  }

  if (lower === "count" || lower === "counts") {
    [
      "count",
      "counts",
      "total",
      "hits",
      "attempts",
    ].forEach(add);
  }

  if (lower === "status" || lower === "statuses") {
    [
      "status",
      "statuses",
      "state",
      "states",
      "completed",
      "failed",
      "running",
      "queued",
    ].forEach(add);
  }
}

function buildConceptualVariants(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return [];

  const out = new Set();
  const lower = raw.toLowerCase();

  function add(value) {
    const text = String(value || "").trim();
    if (!text) return;
    if (isUsefulToken(text, config)) out.add(text);
  }

  add(raw);
  add(lower);

  if (raw.includes("-")) {
    add(raw.replace(/-/g, "_"));
    add(raw.replace(/-/g, ""));
    add(raw.replace(/-/g, " "));
  }

  if (raw.includes("_")) {
    add(raw.replace(/_/g, "-"));
    add(raw.replace(/_/g, ""));
    add(raw.replace(/_/g, " "));
  }

  addMorphVariants(lower, add);

  if (lower.includes("retries")) {
    add(lower.replace(/retries/g, "retry"));
  }
  if (lower.includes("retry")) {
    add(lower.replace(/retry/g, "retries"));
    add("retry_at");
    add("max_retries");
    add("retry_policy");
    add("retry_count");
    add("maxRetries");
    add("computeBackoffDelayMs");
    add("shouldRetry");
  }

  if (lower.includes("fail")) {
    add("fail_reason");
    add("fail_reasons");
    add("fail_code");
    add("failed_at");
    add("last_error_at");
    add("failure_reason");
    add("error_code");
    add("markTaskRunFailed");
    add("normalizeFailCode");
  }

  if (lower.includes("reason")) {
    add("fail_reason");
    add("fail_reasons");
    add("failure_reason");
    add("error_reason");
  }

  if (lower.includes("error")) {
    add("error_code");
    add("last_error_at");
    add("fail_reason");
    add("fail_code");
  }

  if (lower === "dlq" || lower.includes("dead_letter") || lower.includes("dead-letter")) {
    [
      "dead_letter",
      "dead_letter_queue",
      "dead-letter",
      "dead-letter-queue",
      "move_to_dlq",
      "moveToDlq",
      "dlq_jobs",
      "DlqRepo",
      "JOB_DLQ_ENABLED",
      "_moveToDLQ",
      "getDLQ",
      "enableDLQ",
      "_dlqEnabled",
    ].forEach(add);
  }

  addConceptFamilies(lower, add);

  return uniq(Array.from(out));
}

function buildPhraseSemanticSignals(text, config) {
  const source = String(text || "");
  const out = new Set();

  function add(value) {
    const token = String(value || "").trim();
    if (!token) return;
    if (isUsefulToken(token, config)) out.add(token);
  }

  function addExpanded(value) {
    for (const variant of buildConceptualVariants(value, config)) {
      add(variant);
    }
  }

  const words = splitPhraseWords(source);

  for (const word of words) {
    addExpanded(word);
  }

  for (let i = 0; i < words.length; i += 1) {
    const one = words[i];
    const two = words.slice(i, i + 2);
    const three = words.slice(i, i + 3);
    const four = words.slice(i, i + 4);

    if (two.length === 2) {
      addDelimiterVariants(two, addExpanded);
    }

    if (three.length === 3) {
      addDelimiterVariants(three, addExpanded);
    }

    if (four.length === 4) {
      addDelimiterVariants(four, addExpanded);
    }

    if (one === "dead" && words[i + 1] === "letter") {
      addExpanded("dead_letter");
      addExpanded("dead_letter_queue");
      addExpanded("dlq");
    }

    if (one === "fail" && words[i + 1] === "reasons") {
      addExpanded("fail_reasons");
      addExpanded("fail_reason");
    }

    if (one === "retry" && words[i + 1] === "policy") {
      addExpanded("retry_policy");
      addExpanded("max_retries");
      addExpanded("computeBackoffDelayMs");
      addExpanded("shouldRetry");
    }

    if (one === "retries" && words[i + 1] === "fail") {
      addExpanded("retry");
      addExpanded("fail");
      addExpanded("retry_at");
      addExpanded("fail_reason");
    }
  }

  return uniq(Array.from(out));
}

export function extractIdentifiers(text, config) {
  const source = String(text || "");

  const snake = source.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) || [];
  const upper = source.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [];
  const camel = source.match(/\b[a-z]+(?:[A-Z][a-z0-9]+){1,}\b/g) || [];
  const pascal = source.match(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g) || [];
  const kebab = source.match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g) || [];

  const base = uniq([...snake, ...upper, ...camel, ...pascal, ...kebab]).filter((token) =>
    isUsefulToken(token, config)
  );

  const expanded = [];
  for (const token of base) {
    expanded.push(...buildConceptualVariants(token, config));
  }

  return uniq(expanded).filter((token) => isUsefulToken(token, config));
}

function isPascalCaseToken(token) {
  return /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/.test(String(token || ""));
}

export function canGenerateBasenameFromSignal(token, config) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return false;
  if (!isPascalCaseToken(raw)) return false;
  if (config.basenameBlocklist.has(lower)) return false;

  const hasKnownSuffix = config.basenameSignalSuffixes.some((suffix) =>
    raw.endsWith(suffix)
  );

  if (hasKnownSuffix) return true;

  if (!config.allowPascalCaseBasenameSignals) return false;
  if (raw.length < config.minPascalCaseBasenameLength) return false;

  return true;
}

export function buildCandidateBasenamesFromToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return [];

  return uniq([
    `${raw}.js`,
    `${raw}.mjs`,
    `${raw}.cjs`,
    `${raw}.ts`,
    `${raw}.mts`,
    `${raw}.cts`,
  ]);
}

function extractDefinitionUsageSignals(text, config) {
  const out = [];
  const fnTokens = extractFunctionLikeTokens(text);

  for (const token of fnTokens) {
    out.push(token);
    out.push(...buildConceptualVariants(token, config));
  }

  return uniq(out).filter((token) => isUsefulToken(token, config));
}

function classifyItemSemantics(item) {
  const ownText = `${item.title}\n${item.body || ""}`;
  const title = String(item.title || "");
  const lowerTitle = title.toLowerCase();

  const fnTokens = extractFunctionLikeTokens(ownText);
  const hasExplicitSignature = fnTokens.some((x) => String(x).includes("(") && String(x).includes(")"));
  const hasFunctionName = fnTokens.some((x) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(x || "")));
  const hasInterfaceWord =
    lowerTitle.includes("interface") ||
    lowerTitle.includes("contract") ||
    lowerTitle.includes("methods");

  const slashList = extractSlashListItems(ownText);
  const hasSlashList = slashList.length > 0;

  let semanticType = "generic";
  if (hasInterfaceWord && hasSlashList) semanticType = "interface_like";
  else if (hasExplicitSignature || hasFunctionName) semanticType = "signature_like";

  return {
    semanticType,
    functionTokens: fnTokens,
    hasInterfaceWord,
    hasSlashList,
  };
}

function classifySignalEvidence(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return "generic";

  if (
    raw.includes("/") ||
    raw.endsWith(".js") ||
    raw.endsWith(".ts") ||
    raw.endsWith(".sql") ||
    raw.endsWith(".json") ||
    raw.endsWith(".md")
  ) {
    return "structural";
  }

  if (
    raw.includes("(") ||
    /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)
  ) {
    return "interface";
  }

  if (
    lower.includes("retry") ||
    lower.includes("backoff") ||
    lower.includes("jitter")
  ) {
    return "behavioral";
  }

  if (
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("reason") ||
    lower.includes("status") ||
    lower.includes("attempt") ||
    lower.includes("_at") ||
    lower.includes("count")
  ) {
    return "observational";
  }

  if (
    lower.includes("dlq") ||
    lower.includes("dead_letter") ||
    lower.includes("dead-letter") ||
    lower.includes("queue")
  ) {
    return "behavioral";
  }

  if (
    lower.includes("access") ||
    lower.includes("permission") ||
    lower.startsWith("can")
  ) {
    return "relational";
  }

  return "generic";
}

function buildEvidenceProfile({ own, inheritedSignals, explicitPaths, commands }) {
  const structural = new Set();
  const behavioral = new Set();
  const observational = new Set();
  const interfaceLike = new Set();
  const relational = new Set();
  const generic = new Set();

  for (const path of explicitPaths || []) structural.add(path);
  for (const cmd of commands || []) interfaceLike.add(cmd);

  for (const token of [...(own || []), ...(inheritedSignals || [])]) {
    const klass = classifySignalEvidence(token);

    if (klass === "structural") structural.add(token);
    else if (klass === "behavioral") behavioral.add(token);
    else if (klass === "observational") observational.add(token);
    else if (klass === "interface") interfaceLike.add(token);
    else if (klass === "relational") relational.add(token);
    else generic.add(token);
  }

  return {
    structural: Array.from(structural),
    behavioral: Array.from(behavioral),
    observational: Array.from(observational),
    interface: Array.from(interfaceLike),
    relational: Array.from(relational),
    generic: Array.from(generic),
  };
}

export function collectOwnSignals(item, config) {
  const ownText = `${item.title}\n${item.body || ""}`;
  const ownPaths = extractExplicitPaths(ownText);
  const ownCommands = extractCommands(ownText);
  const ownBackticked = extractBackticked(ownText);
  const ownSlashList = extractSlashListItems(ownText);
  const ownIdentifiers = extractIdentifiers(ownText, config);
  const ownPhraseSignals = buildPhraseSemanticSignals(ownText, config);
  const ownDefinitionSignals = extractDefinitionUsageSignals(ownText, config);
  const semantics = classifyItemSemantics(item);

  const ownBacktickPaths = ownBackticked.filter((x) => x.includes("/") && x.includes("."));
  const ownBacktickCommands = ownBackticked.filter((x) => x.startsWith("/"));
  const ownBacktickIdentifiers = ownBackticked.filter(
    (x) => !x.startsWith("/") && !(x.includes("/") && x.includes("."))
  );

  const expandedBackticks = [];
  for (const token of ownBacktickIdentifiers) {
    expandedBackticks.push(...buildConceptualVariants(token, config));
  }

  const signals = uniq([
    ...ownIdentifiers,
    ...ownSlashList,
    ...expandedBackticks,
    ...ownPhraseSignals,
    ...ownDefinitionSignals,
  ]).filter((token) => isUsefulToken(token, config));

  return {
    explicitPaths: uniq([...ownPaths, ...ownBacktickPaths]),
    commands: uniq([...ownCommands, ...ownBacktickCommands.map((x) => x.toLowerCase())]),
    signals,
    semantics,
    evidenceProfile: buildEvidenceProfile({
      own: signals,
      inheritedSignals: [],
      explicitPaths: uniq([...ownPaths, ...ownBacktickPaths]),
      commands: uniq([...ownCommands, ...ownBacktickCommands.map((x) => x.toLowerCase())]),
    }),
  };
}

export function collectInheritedSignals(item, itemMap, config) {
  const ancestorSignals = [];
  const ancestors = getAncestorChain(item, itemMap);

  for (const parent of ancestors) {
    const parentText = `${parent.title}\n${parent.body || ""}`;
    const tokens = uniq([
      ...extractIdentifiers(parentText, config),
      ...extractBackticked(parentText),
      ...extractSlashListItems(parentText),
      ...buildPhraseSemanticSignals(parentText, config),
      ...extractDefinitionUsageSignals(parentText, config),
    ]);

    for (const token of tokens) {
      for (const variant of buildConceptualVariants(token, config)) {
        if (canGenerateBasenameFromSignal(variant, config) || isUsefulToken(variant, config)) {
          ancestorSignals.push(variant);
        }
      }
    }
  }

  return uniq(ancestorSignals).slice(0, config.maxInheritedSignals);
}

function parseStructuredTuplePart(rawPart) {
  const value = String(rawPart || "").trim();
  if (!value) return null;

  const match = value.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(ASC|DESC))?$/i);
  if (!match) return null;

  return {
    name: String(match[1] || "").toLowerCase(),
    sort: match[2] ? String(match[2]).toUpperCase() : null,
  };
}

function normalizeTableName(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (!/^[a-z_][a-z0-9_]*$/.test(text)) return "";
  return text;
}

export function extractLikelyTableNames(text) {
  const source = String(text || "");
  const out = [];

  const directPatterns = [
    /createTable\s*\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi,
    /\btable\s+["'`]([a-z_][a-z0-9_]*)["'`]/gi,
    /["'`]([a-z_][a-z0-9_]*)["'`]\s+table\b/gi,
    /\b([a-z_][a-z0-9_]*)\s+table\b/gi,
  ];

  for (const re of directPatterns) {
    let hit;
    while ((hit = re.exec(source))) {
      const value = normalizeTableName(hit[1]);
      if (value) out.push(value);
    }
  }

  return uniq(out);
}

function decrementTrailingNumericSegment(code) {
  const normalized = normalizeItemCode(code);
  if (!normalized) return null;

  const parts = normalized.split(".");
  const last = parts[parts.length - 1];

  if (!/^\d+$/.test(last)) return null;

  const num = Number(last);
  if (!Number.isFinite(num) || num <= 1) return null;

  parts[parts.length - 1] = String(num - 1);
  return parts.join(".");
}

function collectPreviousSiblingCodes(startCode, limit = 3) {
  const out = [];
  let current = normalizeItemCode(startCode);

  for (let i = 0; i < limit; i += 1) {
    current = decrementTrailingNumericSegment(current);
    if (!current) break;
    out.push(current);
  }

  return out;
}

function collectContextTableNames(item, itemMap) {
  const out = [];
  const visited = new Set();

  function pushFromText(text) {
    const names = extractLikelyTableNames(text);
    for (const name of names) {
      if (!visited.has(name)) {
        visited.add(name);
        out.push(name);
      }
    }
  }

  pushFromText(`${item.title}\n${item.body || ""}`);

  const ancestors = getAncestorChain(item, itemMap);
  for (const parent of ancestors) {
    pushFromText(`${parent.title}\n${parent.body || ""}`);
  }

  const relatedCodes = [];

  if (item.parentCode) {
    relatedCodes.push(...collectPreviousSiblingCodes(item.parentCode, 3));
  }

  for (const parent of ancestors) {
    if (parent.parentCode) {
      relatedCodes.push(...collectPreviousSiblingCodes(parent.code, 3));
    }
  }

  for (const code of uniq(relatedCodes)) {
    const relatedItem = itemMap.get(code);
    if (!relatedItem) continue;
    pushFromText(`${relatedItem.title}\n${relatedItem.body || ""}`);
  }

  return out;
}

export function extractStructuredTuplePatterns(text) {
  const source = String(text || "");
  const matches = [];
  const re = /(unique\s+)?\(([^()]+)\)/gi;
  let hit;

  while ((hit = re.exec(source))) {
    const unique = !!hit[1];
    const inner = String(hit[2] || "").trim();
    if (!inner || !inner.includes(",")) continue;

    const fields = inner
      .split(",")
      .map((part) => parseStructuredTuplePart(part))
      .filter(Boolean);

    if (fields.length < 2) continue;

    matches.push({
      type: "structured_index_exists",
      unique,
      fields,
      raw: `${unique ? "unique " : ""}(${inner})`,
      label: `structured tuple: ${unique ? "unique " : ""}(${inner})`,
    });
  }

  return uniq(matches.map((x) => JSON.stringify(x))).map((x) => JSON.parse(x));
}

function withPreferredTableName(patterns, tableName) {
  const normalizedTable = normalizeTableName(tableName);
  if (!normalizedTable) return patterns;

  return patterns.map((pattern) => ({
    ...pattern,
    tableName: normalizedTable,
    label: `${pattern.label} @ ${normalizedTable}`,
  }));
}

export function buildStructuredChecksForItem(item, itemMap) {
  const ancestors = getAncestorChain(item, itemMap);
  const ownText = `${item.title}\n${item.body || ""}`;
  const ancestorTexts = ancestors.map((x) => `${x.title}\n${x.body || ""}`);

  const ownPatterns = extractStructuredTuplePatterns(ownText);
  const contextTableNames = collectContextTableNames(item, itemMap);

  if (ownPatterns.length > 0) {
    return withPreferredTableName(ownPatterns, contextTableNames[0] || "");
  }

  for (let i = 0; i < ancestorTexts.length; i += 1) {
    const text = ancestorTexts[i];
    const inheritedPatterns = extractStructuredTuplePatterns(text);
    if (inheritedPatterns.length === 0) continue;

    return withPreferredTableName(inheritedPatterns, contextTableNames[0] || "");
  }

  return [];
}

function normalizeClusterToken(token, config, sourceType = "signal") {
  const raw = String(token || "").trim();
  if (!raw) return "";

  const value = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!value) return "";

  if (sourceType === "command") {
    return "";
  }

  if (!isUsefulToken(value, config)) return "";
  return value;
}

function rankClusterToken(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  let score = 0;

  if (/[A-Z]/.test(raw) && /[a-z]/.test(raw)) score += 4;
  if (raw.includes("_")) score += 3;
  if (raw.includes("-")) score += 2;
  if (raw.includes("(")) score += 5;
  if (/^[A-Z0-9_]+$/.test(raw) && raw.length >= 3) score += 2;
  if (lower.includes("retry")) score += 4;
  if (lower.includes("fail")) score += 4;
  if (lower.includes("reason")) score += 3;
  if (lower.includes("error")) score += 3;
  if (lower.includes("dlq")) score += 5;
  if (lower.includes("dead_letter")) score += 5;
  if (lower.includes("dead-letter")) score += 5;
  if (lower.includes("_at")) score += 3;
  if (lower.includes("count")) score += 2;
  if (lower === "can" || lower.startsWith("can(")) score += 5;
  if (lower.includes("permission")) score += 3;
  if (lower.includes("access")) score += 2;
  if (isWeakGenericToken(lower)) score -= 4;

  score += Math.min(raw.length, 20) * 0.05;

  return score;
}

function takeTopTokens(tokens, limit) {
  return uniq(tokens)
    .sort((a, b) => rankClusterToken(b) - rankClusterToken(a))
    .slice(0, Math.max(0, limit));
}

function buildClusterBuckets({ own, inheritedSignals, config }) {
  const profile = buildEvidenceProfile({
    own: own.signals || [],
    inheritedSignals: inheritedSignals || [],
    explicitPaths: own.explicitPaths || [],
    commands: own.commands || [],
  });

  const buckets = {
    structural: [],
    behavioral: [],
    observational: [],
    interface: [],
    relational: [],
    generic: [],
  };

  for (const token of profile.structural) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.structural.push(normalized);
  }

  for (const token of profile.behavioral) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.behavioral.push(normalized);
  }

  for (const token of profile.observational) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.observational.push(normalized);
  }

  for (const token of profile.interface) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.interface.push(normalized);
  }

  for (const token of profile.relational) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.relational.push(normalized);
  }

  for (const token of profile.generic) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized) buckets.generic.push(normalized);
  }

  return buckets;
}

function buildClusterTokens({ own, inheritedSignals, config }) {
  const buckets = buildClusterBuckets({ own, inheritedSignals, config });
  const maxTokens = Math.max(1, config.clusterMaxTokens);

  const result = [];
  const bucketOrder = [
    "structural",
    "behavioral",
    "observational",
    "interface",
    "relational",
    "generic",
  ];

  const bucketLimits = {
    structural: 2,
    behavioral: 3,
    observational: 3,
    interface: 2,
    relational: 1,
    generic: 1,
  };

  for (const bucketName of bucketOrder) {
    const picked = takeTopTokens(
      buckets[bucketName] || [],
      bucketLimits[bucketName] || 1
    );
    result.push(...picked);
  }

  if (uniq(result).length < maxTokens) {
    const merged = [];
    for (const bucketName of bucketOrder) {
      merged.push(...(buckets[bucketName] || []));
    }

    for (const token of takeTopTokens(merged, maxTokens * 2)) {
      if (result.length >= maxTokens) break;
      if (!result.includes(token)) result.push(token);
    }
  }

  return uniq(result).slice(0, maxTokens);
}

function buildClusterCheck({ own, inheritedSignals, config }) {
  const tokens = buildClusterTokens({ own, inheritedSignals, config });
  if (tokens.length < Math.max(3, config.clusterMinMatchedTokens)) return null;

  return {
    type: "signal_cluster_exists",
    tokens,
    minMatchedTokens: Math.max(1, config.clusterMinMatchedTokens),
    minDistinctFiles: Math.max(1, config.clusterMinDistinctFiles),
    strongMatchedTokens: Math.max(
      Math.max(1, config.clusterMinMatchedTokens),
      config.clusterStrongMatchedTokens
    ),
    strongDistinctFiles: Math.max(
      Math.max(1, config.clusterMinDistinctFiles),
      config.clusterStrongDistinctFiles
    ),
    label: `signal cluster: ${tokens.join(", ")}`,
  };
}

function buildFunctionContractChecks(item, own, inheritedSignals) {
  const checks = [];
  const ownText = `${item.title}\n${item.body || ""}`;
  const fnTokens = extractFunctionLikeTokens(ownText);
  const semantics = own.semantics || { semanticType: "generic" };

  const seen = new Set();

  function push(check) {
    const key = JSON.stringify(check);
    if (seen.has(key)) return;
    seen.add(key);
    checks.push(check);
  }

  if (semantics.semanticType === "signature_like") {
    for (const token of fnTokens) {
      const raw = String(token || "").trim();
      if (!raw) continue;

      if (raw.endsWith("(")) {
        push({
          type: "text_exists",
          token: raw,
          label: `function call token: ${raw}`,
          evidenceClass: "signature_anchor",
        });
        continue;
      }

      if (raw.includes("(")) {
        push({
          type: "text_exists",
          token: raw,
          label: `function signature token: ${raw}`,
          evidenceClass: "signature_anchor",
        });
        continue;
      }

      push({
        type: "text_exists",
        token: raw,
        label: `function token: ${raw}`,
        evidenceClass: isWeakGenericToken(raw) ? "generic_support" : "function_name",
      });

      push({
        type: "text_exists",
        token: `${raw}(`,
        label: `function call token: ${raw}(`,
        evidenceClass: "signature_anchor",
      });
    }
  }

  if (semantics.semanticType === "interface_like") {
    const mergedSignals = uniq([...(own.signals || []), ...(inheritedSignals || [])]);

    for (const token of mergedSignals) {
      const raw = String(token || "").trim();
      if (!raw) continue;

      const lower = raw.toLowerCase();

      if (
        lower === "memoryservice" ||
        lower === "jobrunner" ||
        lower === "interface" ||
        lower === "interfaces" ||
        lower === "contract" ||
        lower === "contracts"
      ) {
        push({
          type: "text_exists",
          token: raw,
          label: `contract carrier token: ${raw}`,
          evidenceClass: "carrier_anchor",
        });
      }
    }
  }

  return checks;
}

export function buildAutoChecksForItem(item, itemMap, config) {
  const own = collectOwnSignals(item, config);
  const inheritedSignals = collectInheritedSignals(item, itemMap, config);
  const structuredChecks = buildStructuredChecksForItem(item, itemMap);

  const priorityChecks = [];
  const normalChecks = [];
  const seen = new Set();

  function pushCheck(target, check) {
    const key =
      check.type === "file_exists"
        ? `file:${check.path}`
        : check.type === "basename_exists"
          ? `basename:${String(check.basename || "").toLowerCase()}`
          : check.type === "structured_index_exists"
            ? `structured:${JSON.stringify({
                tableName: String(check.tableName || "").toLowerCase(),
                unique: !!check.unique,
                fields: check.fields || [],
              })}`
            : check.type === "signal_cluster_exists"
              ? `cluster:${JSON.stringify({
                  tokens: check.tokens || [],
                  minMatchedTokens: Number(check.minMatchedTokens || 0),
                  minDistinctFiles: Number(check.minDistinctFiles || 0),
                  strongMatchedTokens: Number(check.strongMatchedTokens || 0),
                  strongDistinctFiles: Number(check.strongDistinctFiles || 0),
                })}`
              : `text:${String(check.token || "").toLowerCase()}:${String(check.evidenceClass || "")}`;

    if (seen.has(key)) return;
    seen.add(key);
    target.push(check);
  }

  if (item.kind === "stage" || item.kind === "substage") {
    for (const path of own.explicitPaths) {
      pushCheck(normalChecks, {
        type: "file_exists",
        path,
        label: `file path: ${path}`,
      });
    }

    for (const cmd of own.commands) {
      pushCheck(normalChecks, {
        type: "text_exists",
        token: cmd,
        label: `command token: ${cmd}`,
        evidenceClass: "command_surface",
      });
    }

    return normalChecks.slice(0, config.maxChecksPerItem);
  }

  for (const structuredCheck of structuredChecks) {
    pushCheck(priorityChecks, structuredCheck);
  }

  const clusterCheck = buildClusterCheck({ own, inheritedSignals, config });
  if (clusterCheck) {
    pushCheck(priorityChecks, clusterCheck);
  }

  const functionContractChecks = buildFunctionContractChecks(item, own, inheritedSignals);
  for (const check of functionContractChecks) {
    pushCheck(priorityChecks, check);
  }

  for (const path of own.explicitPaths) {
    pushCheck(normalChecks, {
      type: "file_exists",
      path,
      label: `file path: ${path}`,
      evidenceClass: "explicit_file",
    });
  }

  for (const cmd of own.commands) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token: cmd,
      label: `command token: ${cmd}`,
      evidenceClass: "command_surface",
    });
  }

  for (const token of own.signals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `signal token: ${token}`,
      evidenceClass: isWeakGenericToken(token) ? "generic_support" : "semantic_support",
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for signal: ${basename}`,
          evidenceClass: "basename_anchor",
        });
      }
    }
  }

  for (const token of inheritedSignals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `inherited signal: ${token}`,
      evidenceClass: isWeakGenericToken(token) ? "generic_support" : "semantic_support",
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for inherited signal: ${basename}`,
          evidenceClass: "basename_anchor",
        });
      }
    }
  }

  const maxChecks = Math.max(0, config.maxChecksPerItem);
  if (maxChecks === 0) return [];

  const result = [];
  for (const check of priorityChecks) {
    if (result.length >= maxChecks) break;
    result.push(check);
  }

  for (const check of normalChecks) {
    if (result.length >= maxChecks) break;
    result.push(check);
  }

  return result;
}