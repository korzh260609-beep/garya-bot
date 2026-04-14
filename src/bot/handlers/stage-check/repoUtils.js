// ============================================================================
// === src/bot/handlers/stage-check/repoUtils.js
// ============================================================================

import { escapeRegExp, uniq } from "./common.js";

const SELF_EVIDENCE_PREFIXES = [
  "src/bot/handlers/stage-check/",
];

export function findBasenameInRepo(basename, fileSet) {
  const target = String(basename || "").toLowerCase();

  for (const path of fileSet) {
    const lower = String(path || "").toLowerCase();
    if (lower.endsWith(`/${target}`) || lower === target) {
      return path;
    }
  }

  return null;
}

function isSelfEvidencePath(path) {
  const value = String(path || "").toLowerCase();
  return SELF_EVIDENCE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export async function safeFetchTextFile(path, ctx) {
  if (ctx.contentCache.has(path)) {
    return ctx.contentCache.get(path);
  }

  if (ctx.fetchStats.used >= ctx.config.maxFileFetchesPerCommand) {
    ctx.contentCache.set(path, null);
    return null;
  }

  ctx.fetchStats.used += 1;

  try {
    const file = await ctx.source.fetchTextFile(path);
    const content = file?.content || null;
    ctx.contentCache.set(path, content);
    return content;
  } catch {
    ctx.errorStats.fetchFailures += 1;
    ctx.contentCache.set(path, null);
    return null;
  }
}

function makeTokenRegex(token) {
  return new RegExp(
    `(^|[^A-Za-z0-9_])${escapeRegExp(String(token || "").trim())}([^A-Za-z0-9_]|$)`,
    "i"
  );
}

function makeLooseTokenRegex(token) {
  const raw = String(token || "").trim();
  if (!raw) return null;

  const normalized = escapeRegExp(raw)
    .replace(/\\[-\s]+/g, "[_\\-\\s]?")
    .replace(/_/g, "[_\\-\\s]?");

  return new RegExp(
    `(^|[^A-Za-z0-9_])${normalized}([^A-Za-z0-9_]|$)`,
    "i"
  );
}

function buildPathTokenVariants(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();
  if (!lower) return [];

  const out = new Set([lower]);

  if (lower.includes("_")) {
    out.add(lower.replace(/_/g, "-"));
    out.add(lower.replace(/_/g, ""));
  }

  if (lower.includes("-")) {
    out.add(lower.replace(/-/g, "_"));
    out.add(lower.replace(/-/g, ""));
  }

  if (lower.includes(" ")) {
    out.add(lower.replace(/\s+/g, "_"));
    out.add(lower.replace(/\s+/g, "-"));
    out.add(lower.replace(/\s+/g, ""));
  }

  if (lower.endsWith("(")) {
    out.add(lower.slice(0, -1));
  }

  if (lower.includes("(")) {
    const prefix = lower.split("(")[0]?.trim();
    if (prefix) out.add(prefix);
  }

  return Array.from(out).filter(Boolean);
}

function filePathLooksRelevant(path, token) {
  const lowerPath = String(path || "").toLowerCase();
  const variants = buildPathTokenVariants(token);
  return variants.some((variant) => variant && lowerPath.includes(variant));
}

function normalizeSearchToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  return raw;
}

function contentMatchesToken(content, token, exactRegex, looseRegex) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  if (raw.endsWith("(")) {
    return content.includes(raw);
  }

  if (raw.includes("(")) {
    return content.includes(raw);
  }

  return (
    content.includes(raw) ||
    exactRegex.test(content) ||
    (looseRegex ? looseRegex.test(content) : false)
  );
}

function preferNonSelfEvidence(paths) {
  return paths.filter((p) => !isSelfEvidencePath(p));
}

function getSearchState(ctx) {
  if (!ctx.tokenHitsCache) ctx.tokenHitsCache = new Map();
  if (!ctx.searchState) {
    ctx.searchState = {
      relevantPathCache: new Map(),
      broadCursor: 0,
    };
  }
  return ctx.searchState;
}

function splitPascalCase(text) {
  return String(text || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function expandTokenVariants(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return [];

  const out = new Set([raw, lower]);

  for (const item of buildPathTokenVariants(raw)) out.add(item);

  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)) {
    const parts = splitPascalCase(raw);
    if (parts.length > 1) {
      out.add(parts.join("_"));
      out.add(parts.join("-"));
      out.add(parts.join(""));
      out.add(parts.join(" "));
    }
  }

  if (lower.includes("retries")) out.add(lower.replace(/retries/g, "retry"));
  if (lower.includes("retry")) out.add(lower.replace(/retry/g, "retries"));

  if (lower === "dlq") {
    out.add("dead_letter");
    out.add("dead_letter_queue");
    out.add("dead-letter");
    out.add("dead-letter-queue");
    out.add("move_to_dlq");
    out.add("movetodlq");
    out.add("dlqrepo");
    out.add("job_dlq_enabled");
  }

  if (lower.includes("dead_letter") || lower.includes("dead-letter")) {
    out.add("dlq");
  }

  if (lower.includes("fail_reason")) out.add("failure_reason");
  if (lower.includes("failure_reason")) out.add("fail_reason");

  return Array.from(out).filter(Boolean);
}

function rankPathForToken(path, token) {
  const lowerPath = String(path || "").toLowerCase();
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  let score = 0;

  if (isSelfEvidencePath(path)) score -= 100;

  if (filePathLooksRelevant(path, raw)) score += 40;

  if (lowerPath.startsWith("src/")) score += 10;
  if (lowerPath.startsWith("migrations/")) score += 8;
  if (lowerPath.startsWith("pillars/")) score -= 4;

  if (lower.includes("retry") && lowerPath.includes("retry")) score += 25;
  if (lower.includes("fail") && lowerPath.includes("fail")) score += 25;
  if (lower.includes("error") && lowerPath.includes("error")) score += 20;
  if (lower.includes("reason") && lowerPath.includes("reason")) score += 20;
  if (lower.includes("dlq") && lowerPath.includes("dlq")) score += 30;
  if (lower.includes("dead_letter") && lowerPath.includes("dlq")) score += 20;

  score -= Math.min(lowerPath.length, 120) * 0.01;

  return score;
}

function getRelevantCandidatePaths(token, ctx) {
  const state = getSearchState(ctx);
  const cacheKey = String(token || "").toLowerCase();

  if (state.relevantPathCache.has(cacheKey)) {
    return state.relevantPathCache.get(cacheKey);
  }

  const variants = expandTokenVariants(token);
  const ranked = (Array.isArray(ctx.searchableFiles) ? ctx.searchableFiles : [])
    .map((path) => {
      let score = 0;
      for (const variant of variants) {
        score = Math.max(score, rankPathForToken(path, variant));
      }
      return { path, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.path);

  const limited = ranked.slice(0, Math.max(20, ctx.config.maxSearchFilesPerToken));
  state.relevantPathCache.set(cacheKey, limited);
  return limited;
}

async function searchInPaths(paths, token, ctx, options = {}) {
  const normalizedToken = normalizeSearchToken(token);
  if (!normalizedToken) {
    return { matchedPaths: [], exhausted: false };
  }

  const exactRegex = makeTokenRegex(normalizedToken.replace(/\($/, ""));
  const looseRegex = makeLooseTokenRegex(normalizedToken.replace(/\($/, ""));
  const matchedPaths = [];
  const maxMatches = Number(options.maxMatches || 20);

  for (const path of paths) {
    const content = ctx.contentCache.has(path)
      ? ctx.contentCache.get(path)
      : await safeFetchTextFile(path, ctx);

    if (!content) continue;

    const fastPathHit = filePathLooksRelevant(path, normalizedToken);
    const exactHit = contentMatchesToken(content, normalizedToken, exactRegex, looseRegex);

    if (fastPathHit || exactHit) {
      matchedPaths.push(path);
      if (matchedPaths.length >= maxMatches) {
        return { matchedPaths, exhausted: false };
      }
    }

    if (ctx.fetchStats.used >= ctx.config.maxFileFetchesPerCommand) {
      return { matchedPaths, exhausted: true };
    }
  }

  return { matchedPaths, exhausted: false };
}

async function collectTokenHitPaths(token, ctx) {
  const normalizedToken = normalizeSearchToken(token);
  if (!normalizedToken) {
    return { ok: false, details: "missing_token", paths: [] };
  }

  const state = getSearchState(ctx);
  const cacheKey = normalizedToken.toLowerCase();

  if (ctx.tokenHitsCache.has(cacheKey)) {
    return ctx.tokenHitsCache.get(cacheKey);
  }

  const matchedPaths = [];
  let exhausted = false;

  const relevantPaths = getRelevantCandidatePaths(normalizedToken, ctx);
  const phase1Paths = relevantPaths.slice(0, 12);
  const phase2Paths = relevantPaths.slice(12, 36);

  const phase1 = await searchInPaths(phase1Paths, normalizedToken, ctx, { maxMatches: 20 });
  matchedPaths.push(...phase1.matchedPaths);
  exhausted = exhausted || phase1.exhausted;

  if (!matchedPaths.length && !exhausted) {
    const phase2 = await searchInPaths(
      phase2Paths.filter((p) => !phase1Paths.includes(p)),
      normalizedToken,
      ctx,
      { maxMatches: 20 }
    );
    matchedPaths.push(...phase2.matchedPaths);
    exhausted = exhausted || phase2.exhausted;
  }

  if (!matchedPaths.length && !exhausted) {
    const broadLimit = Math.max(20, Math.min(80, ctx.config.maxSearchFilesPerToken));
    const broadCandidates = (Array.isArray(ctx.searchableFiles) ? ctx.searchableFiles : [])
      .filter((p) => !relevantPaths.includes(p))
      .slice(state.broadCursor, state.broadCursor + broadLimit);

    const broad = await searchInPaths(broadCandidates, normalizedToken, ctx, { maxMatches: 20 });
    matchedPaths.push(...broad.matchedPaths);
    exhausted = exhausted || broad.exhausted;
    state.broadCursor += broadCandidates.length;
  }

  const uniqueMatched = uniq(matchedPaths);
  const nonSelfMatched = preferNonSelfEvidence(uniqueMatched);

  let result;

  if (nonSelfMatched.length > 0) {
    result = {
      ok: true,
      details: `found_in: ${nonSelfMatched[0]}`,
      paths: nonSelfMatched,
      selfOnly: false,
    };
  } else if (uniqueMatched.length > 0) {
    result = {
      ok: false,
      details: `found_only_in_self_checker: ${uniqueMatched[0]}`,
      paths: [],
      selfOnly: true,
    };
  } else if (ctx.errorStats.fetchFailures > 0) {
    result = {
      ok: false,
      details: "search_unavailable_or_not_found",
      paths: [],
      selfOnly: false,
    };
  } else if (exhausted || ctx.fetchStats.used >= ctx.config.maxFileFetchesPerCommand) {
    result = {
      ok: false,
      details: "search_budget_exhausted",
      paths: [],
      selfOnly: false,
    };
  } else {
    result = {
      ok: false,
      details: "not_found_in_repo_text",
      paths: [],
      selfOnly: false,
    };
  }

  ctx.tokenHitsCache.set(cacheKey, result);
  return result;
}

export async function searchTokenInRepo(token, ctx) {
  const result = await collectTokenHitPaths(token, ctx);
  return {
    ok: result.ok,
    details: result.details,
  };
}

function normalizeClusterTokens(tokens) {
  return uniq(
    (Array.isArray(tokens) ? tokens : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  );
}

export async function findSignalClusterInRepo(check, ctx) {
  const tokens = normalizeClusterTokens(check?.tokens);
  if (!tokens.length) {
    return {
      ok: false,
      details: "cluster_missing_tokens",
      matchedTokens: 0,
      distinctFiles: 0,
      strength: "none",
    };
  }

  const minMatchedTokens = Math.max(1, Number(check?.minMatchedTokens || 2));
  const minDistinctFiles = Math.max(1, Number(check?.minDistinctFiles || 2));
  const strongMatchedTokens = Math.max(
    minMatchedTokens,
    Number(check?.strongMatchedTokens || Math.max(3, minMatchedTokens + 1))
  );
  const strongDistinctFiles = Math.max(
    minDistinctFiles,
    Number(check?.strongDistinctFiles || minDistinctFiles)
  );

  const tokenHits = [];
  const fileHitSet = new Set();
  const nonSelfFileHitSet = new Set();
  let exhaustedCount = 0;
  let selfOnlyCount = 0;

  for (const token of tokens) {
    const hit = await collectTokenHitPaths(token, ctx);

    if (hit.details === "search_budget_exhausted") {
      exhaustedCount += 1;
    }

    if (hit.selfOnly) {
      selfOnlyCount += 1;
    }

    if (!hit.ok || !Array.isArray(hit.paths) || hit.paths.length === 0) continue;

    tokenHits.push({
      token,
      paths: hit.paths.slice(0, 5),
    });

    for (const p of hit.paths) {
      fileHitSet.add(p);
      if (!isSelfEvidencePath(p)) {
        nonSelfFileHitSet.add(p);
      }
    }
  }

  const matchedTokens = tokenHits.length;
  const distinctFiles = fileHitSet.size;
  const distinctNonSelfFiles = nonSelfFileHitSet.size;
  const effectiveDistinctFiles =
    distinctNonSelfFiles > 0 ? distinctNonSelfFiles : distinctFiles;

  const ok = matchedTokens >= minMatchedTokens && effectiveDistinctFiles >= minDistinctFiles;

  let strength = "none";
  if (ok) {
    strength =
      matchedTokens >= strongMatchedTokens && effectiveDistinctFiles >= strongDistinctFiles
        ? "strong"
        : "weak";
  }

  if (ok) {
    const filesPreview = Array.from(
      nonSelfFileHitSet.size > 0 ? nonSelfFileHitSet : fileHitSet
    )
      .slice(0, 4)
      .join(", ");
    const tokensPreview = tokenHits.slice(0, 4).map((x) => x.token).join(", ");

    return {
      ok: true,
      details:
        `cluster_match strength:${strength} ` +
        `tokens:${matchedTokens}/${tokens.length}, files:${effectiveDistinctFiles}; ` +
        `tokens=[${tokensPreview}] files=[${filesPreview}]`,
      matchedTokens,
      distinctFiles: effectiveDistinctFiles,
      strength,
    };
  }

  const reason =
    ctx.errorStats.fetchFailures > 0
      ? "cluster_search_unavailable_or_insufficient_evidence"
      : exhaustedCount > 0
        ? "cluster_budget_limited_or_insufficient_evidence"
        : selfOnlyCount > 0
          ? "cluster_self_evidence_filtered_or_insufficient_evidence"
          : "cluster_insufficient_evidence";

  return {
    ok: false,
    details: `${reason} tokens:${matchedTokens}/${tokens.length}, files:${effectiveDistinctFiles}`,
    matchedTokens,
    distinctFiles: effectiveDistinctFiles,
    strength,
  };
}

function splitTopLevelCommaItems(input) {
  const items = [];
  let current = "";
  let depthCurly = 0;
  let depthSquare = 0;
  let depthRound = 0;
  let quote = null;
  let escaped = false;

  const source = String(input || "");

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "{") depthCurly += 1;
    else if (ch === "}") depthCurly -= 1;
    else if (ch === "[") depthSquare += 1;
    else if (ch === "]") depthSquare -= 1;
    else if (ch === "(") depthRound += 1;
    else if (ch === ")") depthRound -= 1;

    if (
      ch === "," &&
      depthCurly === 0 &&
      depthSquare === 0 &&
      depthRound === 0
    ) {
      const value = current.trim();
      if (value) items.push(value);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) items.push(tail);

  return items;
}

function stripWrappingQuotes(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const first = text[0];
  const last = text[text.length - 1];

  if (
    (first === '"' && last === '"') ||
    (first === "'" && last === "'") ||
    (first === "`" && last === "`")
  ) {
    return text.slice(1, -1);
  }

  return text;
}

function parseIndexFieldItem(itemText) {
  const text = String(itemText || "").trim();
  if (!text) return null;

  if (/^["'`].*["'`]$/.test(text)) {
    return {
      name: stripWrappingQuotes(text).toLowerCase(),
      sort: null,
    };
  }

  if (text.startsWith("{") && text.endsWith("}")) {
    const nameMatch = text.match(/name\s*:\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]/i);
    if (!nameMatch) return null;

    const sortMatch = text.match(/sort\s*:\s*["'`](ASC|DESC)["'`]/i);

    return {
      name: String(nameMatch[1] || "").toLowerCase(),
      sort: sortMatch ? String(sortMatch[1] || "").toUpperCase() : null,
    };
  }

  return null;
}

function extractCreateIndexSpecsFromContent(content) {
  const specs = [];
  const blocks = String(content || "").match(/pgm\.createIndex\s*\([\s\S]*?\);\s*/g) || [];

  for (const block of blocks) {
    const argsStart = block.indexOf("(");
    const argsEnd = block.lastIndexOf(")");
    if (argsStart === -1 || argsEnd === -1 || argsEnd <= argsStart) continue;

    const argsText = block.slice(argsStart + 1, argsEnd).trim();
    const args = splitTopLevelCommaItems(argsText);
    if (args.length < 3) continue;

    const tableArg = args[0];
    const fieldsArg = args[1];
    const optionsArg = args.slice(2).join(",").trim();

    const tableName = stripWrappingQuotes(tableArg).toLowerCase();

    if (!fieldsArg.startsWith("[") || !fieldsArg.endsWith("]")) continue;

    const fieldsInner = fieldsArg.slice(1, -1).trim();
    const fieldItems = splitTopLevelCommaItems(fieldsInner)
      .map((x) => parseIndexFieldItem(x))
      .filter(Boolean);

    if (fieldItems.length === 0) continue;

    const unique = /unique\s*:\s*true/i.test(optionsArg);

    specs.push({
      tableName,
      fields: fieldItems,
      unique,
      raw: block,
    });
  }

  return specs;
}

function normalizeTableName(value) {
  return String(value || "").trim().toLowerCase();
}

function indexSpecMatchesPattern(spec, pattern) {
  const patternFields = Array.isArray(pattern?.fields) ? pattern.fields : [];
  const specFields = Array.isArray(spec?.fields) ? spec.fields : [];

  if (patternFields.length !== specFields.length) return false;
  if (!!pattern?.unique !== !!spec?.unique) return false;

  const expectedTable = normalizeTableName(pattern?.tableName);
  if (expectedTable && expectedTable !== normalizeTableName(spec?.tableName)) {
    return false;
  }

  for (let i = 0; i < patternFields.length; i += 1) {
    const expected = patternFields[i];
    const actual = specFields[i];

    if (!actual) return false;
    if (String(expected.name || "").toLowerCase() !== String(actual.name || "").toLowerCase()) {
      return false;
    }

    const expectedSort = expected.sort ? String(expected.sort).toUpperCase() : null;
    const actualSort = actual.sort ? String(actual.sort).toUpperCase() : null;

    if (expectedSort !== actualSort) return false;
  }

  return true;
}

async function getParsedMigrationIndex(ctx) {
  if (ctx.migrationIndexCache) {
    return ctx.migrationIndexCache;
  }

  const migrationFiles = ctx.searchableFiles.filter((path) => path.startsWith("migrations/"));
  const parsed = [];

  for (const path of migrationFiles) {
    const content = await safeFetchTextFile(path, ctx);
    if (!content) continue;

    const specs = extractCreateIndexSpecsFromContent(content);
    parsed.push({
      path,
      specs,
    });
  }

  ctx.migrationIndexCache = parsed;
  return parsed;
}

export async function findStructuredIndexInMigrations(pattern, ctx) {
  const cacheKey = JSON.stringify({
    type: "structured_index_exists",
    tableName: String(pattern.tableName || "").toLowerCase(),
    unique: !!pattern.unique,
    fields: pattern.fields || [],
  });

  if (ctx.structuredCache.has(cacheKey)) {
    return ctx.structuredCache.get(cacheKey);
  }

  const parsedMigrations = await getParsedMigrationIndex(ctx);

  for (const entry of parsedMigrations) {
    for (const spec of entry.specs) {
      if (indexSpecMatchesPattern(spec, pattern)) {
        const result = {
          ok: true,
          details: `structured_match_in: ${entry.path}${spec.tableName ? ` @ ${spec.tableName}` : ""}`,
        };
        ctx.structuredCache.set(cacheKey, result);
        return result;
      }
    }
  }

  const miss =
    ctx.errorStats.fetchFailures > 0
      ? { ok: false, details: "structured_search_unavailable_or_not_found" }
      : { ok: false, details: "structured_pattern_not_found" };

  ctx.structuredCache.set(cacheKey, miss);
  return miss;
}
