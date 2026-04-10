// ============================================================================
// === src/bot/handlers/stage-check/repoUtils.js
// ============================================================================

import { escapeRegExp } from "./common.js";

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

export async function searchTokenInRepo(token, ctx) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return { ok: false, details: "missing_token" };

  const cacheKey = normalizedToken.toLowerCase();
  if (ctx.searchCache.has(cacheKey)) {
    return ctx.searchCache.get(cacheKey);
  }

  if (ctx.fetchStats.used >= ctx.config.maxFileFetchesPerCommand) {
    const limited = { ok: false, details: "search_budget_exhausted" };
    ctx.searchCache.set(cacheKey, limited);
    return limited;
  }

  const regex = new RegExp(
    `(^|[^A-Za-z0-9_])${escapeRegExp(normalizedToken)}([^A-Za-z0-9_]|$)`,
    "i"
  );

  const limitedFiles = ctx.searchableFiles.slice(0, ctx.config.maxSearchFilesPerToken);

  for (const path of limitedFiles) {
    const content = await safeFetchTextFile(path, ctx);
    if (!content) continue;

    if (content.includes(normalizedToken) || regex.test(content)) {
      const result = { ok: true, details: `found_in: ${path}` };
      ctx.searchCache.set(cacheKey, result);
      return result;
    }
  }

  const miss =
    ctx.errorStats.fetchFailures > 0
      ? { ok: false, details: "search_unavailable_or_not_found" }
      : { ok: false, details: "not_found_in_repo_text" };

  ctx.searchCache.set(cacheKey, miss);
  return miss;
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

  const migrationFiles = ctx.searchableFiles.filter((path) => path.startsWith("migrations/"));

  for (const path of migrationFiles) {
    const content = await safeFetchTextFile(path, ctx);
    if (!content) continue;

    const specs = extractCreateIndexSpecsFromContent(content);
    for (const spec of specs) {
      if (indexSpecMatchesPattern(spec, pattern)) {
        const result = {
          ok: true,
          details: `structured_match_in: ${path}${spec.tableName ? ` @ ${spec.tableName}` : ""}`,
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