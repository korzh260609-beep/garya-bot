// ============================================================================
// === src/bot/handlers/stageCheck.js — READ-ONLY universal workflow checker
// === NO AI / NO HARD-CODED STAGE IDS / TREE + SEMANTIC AUTO-SIGNAL EXTRACTION
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

const WORKFLOW_PATH = "pillars/WORKFLOW.md";
const RULES_PATH = "pillars/STAGE_CHECK_RULES.json";

const CYRILLIC_TO_LATIN_MAP = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
  І: "I",
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  х: "x",
  і: "i"
};

function replaceLookalikeCyrillic(value) {
  return String(value || "")
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN_MAP[ch] || ch)
    .join("");
}

function normalizeItemCode(value) {
  return replaceLookalikeCyrillic(
    String(value || "")
      .trim()
      .replace(/^stage\s+/i, "")
  ).toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch {
    return null;
  }
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function parseMode(rest) {
  const token = String(rest || "")
    .trim()
    .split(/\s+/)[0];

  const normalized = normalizeItemCode(token);

  if (!normalized) return { mode: "current", value: "current" };
  if (normalized === "ALL") return { mode: "all", value: "all" };
  if (normalized === "CURRENT") return { mode: "current", value: "current" };

  return { mode: "item", value: normalized };
}

function getParentCode(code) {
  const value = normalizeItemCode(code);
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  return value.slice(0, lastDot);
}

function isSameOrDescendant(baseCode, candidateCode) {
  const base = normalizeItemCode(baseCode);
  const candidate = normalizeItemCode(candidateCode);
  return candidate === base || candidate.startsWith(`${base}.`);
}

function extractStageHeading(line) {
  const match = String(line || "").match(/^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "stage",
  };
}

function extractSubHeading(line) {
  const match = String(line || "").match(/^##+\s+(.+)$/);
  if (!match) return null;

  const raw = String(match[1] || "").trim();

  const codeMatch =
    raw.match(/\b([0-9]+[A-Za-z]*(?:\.[A-Za-z0-9-]+)+)\b/) ||
    raw.match(/\b([0-9]+[A-Za-z]*)\b/);

  if (!codeMatch) return null;

  const code = normalizeItemCode(codeMatch[1]);
  const title = raw.replace(codeMatch[1], "").trim();

  return {
    code,
    title: title || raw,
    kind: "substage",
  };
}

function extractBulletItem(line) {
  const match = String(line || "").match(/^\s*-\s+([A-Za-z0-9.-]+)\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "point",
  };
}

function parseWorkflowItems(workflowText) {
  const lines = String(workflowText || "").replace(/\r/g, "").split("\n");

  const rawItems = [];
  const seenCodes = new Set();

  let insideWorkflow = false;
  let currentStageCode = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^## 4\)\s+WORKFLOW/i.test(line.trim())) {
      insideWorkflow = true;
      continue;
    }

    if (!insideWorkflow) continue;

    const stageHit = extractStageHeading(line);
    if (stageHit) {
      currentStageCode = stageHit.code;

      if (!seenCodes.has(stageHit.code)) {
        rawItems.push({
          ...stageHit,
          lineIndex: i,
          parentCode: null,
        });
        seenCodes.add(stageHit.code);
      }

      continue;
    }

    if (!currentStageCode) continue;

    const subHit = extractSubHeading(line);
    if (subHit && !seenCodes.has(subHit.code)) {
      rawItems.push({
        ...subHit,
        lineIndex: i,
        parentCode: getParentCode(subHit.code) || currentStageCode,
      });
      seenCodes.add(subHit.code);
      continue;
    }

    const bulletHit = extractBulletItem(line);
    if (bulletHit && !seenCodes.has(bulletHit.code)) {
      rawItems.push({
        ...bulletHit,
        lineIndex: i,
        parentCode: getParentCode(bulletHit.code) || currentStageCode,
      });
      seenCodes.add(bulletHit.code);
    }
  }

  return rawItems.map((item, idx) => {
    const nextLineIndex =
      idx + 1 < rawItems.length ? rawItems[idx + 1].lineIndex : lines.length;

    const body = lines.slice(item.lineIndex + 1, nextLineIndex).join("\n").trim();

    return {
      code: item.code,
      title: item.title,
      kind: item.kind,
      parentCode: item.parentCode,
      body,
      normalizedTitle: normalizeText(item.title),
      normalizedBody: normalizeText(body),
      normalizedText: normalizeText(`${item.title}\n${body}`),
    };
  });
}

function buildItemMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.code, item);
  }
  return map;
}

function getAncestorChain(item, itemMap) {
  const chain = [];
  let currentParentCode = item?.parentCode || null;

  while (currentParentCode) {
    const parent = itemMap.get(currentParentCode);
    if (!parent) break;
    chain.push(parent);
    currentParentCode = parent.parentCode || null;
  }

  return chain;
}

function getDescendants(baseCode, items) {
  return items.filter((item) => item.code !== baseCode && isSameOrDescendant(baseCode, item.code));
}

function getSubtreeItems(baseCode, evaluatedItems) {
  return evaluatedItems.filter((item) => isSameOrDescendant(baseCode, item.code));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildConfig(rulesJson) {
  const cfg = rulesJson?.engine || {};

  return {
    maxChecksPerItem: Number(cfg.max_checks_per_item || 12),
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
          "Policy"
        ],
    basenameBlocklist: new Set(
      Array.isArray(cfg.basename_blocklist)
        ? cfg.basename_blocklist.map((x) => String(x || "").toLowerCase()).filter(Boolean)
        : []
    ),
  };
}

function hasAllowedExtension(path, config) {
  const lower = String(path || "").toLowerCase();
  return config.searchableExtensions.some((ext) => lower.endsWith(ext));
}

function sortSearchPaths(paths, config) {
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

function extractExplicitPaths(text) {
  const matches = String(text || "").match(
    /\b(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+\b/g
  );
  return uniq(matches || []);
}

function extractCommands(text) {
  const matches = String(text || "").match(/\/[a-z][a-z0-9_]+/gi);
  return uniq((matches || []).map((x) => x.toLowerCase()));
}

function extractBackticked(text) {
  const matches = [];
  const re = /`([^`]+)`/g;
  let hit;

  while ((hit = re.exec(String(text || "")))) {
    const value = String(hit[1] || "").trim();
    if (value) matches.push(value);
  }

  return uniq(matches);
}

function extractSlashListItems(text) {
  const out = [];
  const source = String(text || "");

  const patterns = source.match(/\b[A-Za-z][A-Za-z0-9_-]*(?:\/[A-Za-z][A-Za-z0-9_-]*){1,}\b/g) || [];
  for (const entry of patterns) {
    const parts = entry
      .split("/")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const part of parts) {
      out.push(part);
    }

    out.push(entry);
  }

  return uniq(out);
}

function isUsefulToken(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (config.stopTokens.has(lower)) return false;
  if (config.basenameBlocklist.has(lower)) return false;
  if (lower.length < config.minIdentifierLength) return false;

  if (/^[0-9.]+$/.test(lower)) return false;
  if (/^[a-z]$/.test(lower)) return false;
  if (/^[ivxlcdm]+$/i.test(lower)) return false;

  return true;
}

function extractIdentifiers(text, config) {
  const source = String(text || "");

  const snake = source.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) || [];
  const upper = source.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [];
  const camel = source.match(/\b[a-z]+(?:[A-Z][a-z0-9]+){1,}\b/g) || [];
  const pascal = source.match(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g) || [];
  const kebab = source.match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g) || [];

  return uniq([...snake, ...upper, ...camel, ...pascal, ...kebab]).filter((token) =>
    isUsefulToken(token, config)
  );
}

function isPascalCaseToken(token) {
  return /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/.test(String(token || ""));
}

function canGenerateBasenameFromSignal(token, config) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return false;
  if (!isPascalCaseToken(raw)) return false;
  if (config.basenameBlocklist.has(lower)) return false;

  return config.basenameSignalSuffixes.some((suffix) => raw.endsWith(suffix));
}

function buildCandidateBasenamesFromToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return [];

  return uniq([
    `${raw}.js`,
    `${raw}.mjs`,
    `${raw}.cjs`,
    `${raw}.ts`,
    `${raw}.mts`,
    `${raw}.cts`
  ]);
}

function collectSemanticSignals(item, itemMap, allItems, config) {
  const ownText = `${item.title}\n${item.body || ""}`;
  const ownPaths = extractExplicitPaths(ownText);
  const ownCommands = extractCommands(ownText);
  const ownBackticked = extractBackticked(ownText);
  const ownSlashList = extractSlashListItems(ownText);
  const ownIdentifiers = extractIdentifiers(ownText, config);

  const ownBacktickPaths = ownBackticked.filter((x) => x.includes("/") && x.includes("."));
  const ownBacktickCommands = ownBackticked.filter((x) => x.startsWith("/"));
  const ownBacktickIdentifiers = ownBackticked.filter(
    (x) => !x.startsWith("/") && !(x.includes("/") && x.includes("."))
  );

  const ownSignals = uniq([
    ...ownIdentifiers,
    ...ownSlashList,
    ...ownBacktickIdentifiers,
  ]).filter((token) => isUsefulToken(token, config));

  const ancestorSignals = [];
  const ancestors = getAncestorChain(item, itemMap);

  for (const parent of ancestors) {
    const parentText = `${parent.title}\n${parent.body || ""}`;

    const tokens = uniq([
      ...extractIdentifiers(parentText, config),
      ...extractBackticked(parentText),
      ...extractSlashListItems(parentText),
    ]);

    for (const token of tokens) {
      if (canGenerateBasenameFromSignal(token, config) || isUsefulToken(token, config)) {
        ancestorSignals.push(token);
      }
    }
  }

  const descendantSignals = [];
  const descendants = getDescendants(item.code, allItems);

  for (const child of descendants) {
    const childText = `${child.title}\n${child.body || ""}`;

    const tokens = uniq([
      ...extractIdentifiers(childText, config),
      ...extractBackticked(childText),
      ...extractSlashListItems(childText),
    ]);

    for (const token of tokens) {
      if (canGenerateBasenameFromSignal(token, config) || isUsefulToken(token, config)) {
        descendantSignals.push(token);
      }
    }
  }

  return {
    explicitPaths: uniq([...ownPaths, ...ownBacktickPaths]),
    commands: uniq([...ownCommands, ...ownBacktickCommands.map((x) => x.toLowerCase())]),
    ownSignals,
    ancestorSignals: uniq(ancestorSignals).slice(0, config.maxInheritedSignals),
    descendantSignals: uniq(descendantSignals).slice(0, config.maxDescendantSignals),
  };
}

function buildAutoChecksForItem(item, itemMap, allItems, config) {
  const signals = collectSemanticSignals(item, itemMap, allItems, config);
  const checks = [];
  const seen = new Set();

  function pushCheck(check) {
    const key =
      check.type === "file_exists"
        ? `file:${check.path}`
        : check.type === "basename_exists"
          ? `basename:${String(check.basename || "").toLowerCase()}`
          : `text:${String(check.token || "").toLowerCase()}`;

    if (seen.has(key)) return;
    seen.add(key);
    checks.push(check);
  }

  for (const path of signals.explicitPaths) {
    pushCheck({
      type: "file_exists",
      path,
      label: `file path: ${path}`,
    });
  }

  for (const cmd of signals.commands) {
    pushCheck({
      type: "text_exists",
      token: cmd,
      label: `command token: ${cmd}`,
    });
  }

  for (const token of signals.ownSignals) {
    pushCheck({
      type: "text_exists",
      token,
      label: `signal token: ${token}`,
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck({
          type: "basename_exists",
          basename,
          label: `basename for signal: ${basename}`,
        });
      }
    }
  }

  for (const token of signals.ancestorSignals) {
    pushCheck({
      type: "text_exists",
      token,
      label: `inherited signal: ${token}`,
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck({
          type: "basename_exists",
          basename,
          label: `basename for inherited signal: ${basename}`,
        });
      }
    }
  }

  for (const token of signals.descendantSignals) {
    pushCheck({
      type: "text_exists",
      token,
      label: `descendant signal: ${token}`,
    });
  }

  return checks.slice(0, config.maxChecksPerItem);
}

function findBasenameInRepo(basename, fileSet) {
  const target = String(basename || "").toLowerCase();

  for (const path of fileSet) {
    const lower = String(path || "").toLowerCase();
    if (lower.endsWith(`/${target}`) || lower === target) {
      return path;
    }
  }

  return null;
}

async function safeFetchTextFile(path, ctx) {
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
  } catch (error) {
    ctx.errorStats.fetchFailures += 1;
    ctx.contentCache.set(path, null);
    return null;
  }
}

async function searchTokenInRepo(token, ctx) {
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

async function evaluateCheck(check, ctx) {
  if (check.type === "file_exists") {
    const path = String(check.path || "").trim();
    const ok = !!path && ctx.fileSet.has(path);

    return {
      ok,
      type: check.type,
      label: check.label || path || "file_exists",
      details: path || "missing_path",
    };
  }

  if (check.type === "basename_exists") {
    const basename = String(check.basename || "").trim();
    const foundPath = findBasenameInRepo(basename, ctx.fileSet);
    const ok = !!foundPath;

    return {
      ok,
      type: check.type,
      label: check.label || basename || "basename_exists",
      details: ok ? `found_as: ${foundPath}` : "basename_not_found",
    };
  }

  if (check.type === "text_exists") {
    const token = String(check.token || "").trim();

    const searchResult = await searchTokenInRepo(token, ctx);

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || token || "text_exists",
      details: searchResult.details,
    };
  }

  return {
    ok: false,
    type: String(check.type || "unknown"),
    label: String(check.label || "unsupported_check"),
    details: "unsupported_check_type",
  };
}

async function evaluateSingleItem(item, ctx) {
  const autoChecks = buildAutoChecksForItem(
    item,
    ctx.itemMap,
    ctx.allItems,
    ctx.config
  );

  const results = [];
  for (const check of autoChecks) {
    results.push(await evaluateCheck(check, ctx));
  }

  const passedChecks = results.filter((x) => x.ok).length;
  const failedChecks = results.filter((x) => !x.ok).length;

  let status = "NO_SIGNALS";
  if (autoChecks.length > 0 && failedChecks === 0) status = "COMPLETE";
  else if (autoChecks.length > 0) status = "OPEN";

  return {
    code: item.code,
    title: item.title,
    kind: item.kind,
    parentCode: item.parentCode,
    totalChecks: autoChecks.length,
    passedChecks,
    failedChecks,
    status,
    checks: autoChecks,
    results,
  };
}

async function buildEvaluatedItems(workflowItems, ctx) {
  const output = [];
  for (const item of workflowItems) {
    output.push(await evaluateSingleItem(item, ctx));
  }
  return output;
}

function aggregateScope(scopeItems) {
  const configuredItems = scopeItems.filter((x) => x.totalChecks > 0);
  const openItems = scopeItems.filter((x) => x.status === "OPEN");
  const noSignalItems = scopeItems.filter((x) => x.status === "NO_SIGNALS");

  let status = "NO_SIGNALS";
  if (openItems.length > 0) status = "OPEN";
  else if (configuredItems.length > 0) status = "COMPLETE";

  const failedEntries = [];
  for (const item of scopeItems) {
    for (const result of item.results) {
      if (!result.ok) {
        failedEntries.push({
          code: item.code,
          label: result.label,
        });
      }
    }
  }

  return {
    totalItems: scopeItems.length,
    configuredItems: configuredItems.length,
    noSignalItems: noSignalItems.length,
    totalChecks: scopeItems.reduce((sum, x) => sum + x.totalChecks, 0),
    passedChecks: scopeItems.reduce((sum, x) => sum + x.passedChecks, 0),
    failedChecks: scopeItems.reduce((sum, x) => sum + x.failedChecks, 0),
    status,
    failedEntries,
  };
}

function formatSingleItemOutput(baseItem, scopeItems, aggregate, coverageMode) {
  const lines = [];

  lines.push(`stage_check: ${baseItem.code}`);
  lines.push(`workflow: ${baseItem.title || "(title_not_found)"}`);
  lines.push(`status: ${aggregate.status}`);
  lines.push(`scope_items: ${aggregate.totalItems}`);
  lines.push(`configured_items: ${aggregate.configuredItems}`);
  lines.push(`checks: ${aggregate.passedChecks}/${aggregate.totalChecks}`);
  lines.push(`coverage: ${coverageMode}`);

  if (aggregate.noSignalItems > 0) {
    lines.push(`no_signal_items: ${aggregate.noSignalItems}`);
  }

  if (aggregate.failedEntries.length > 0) {
    lines.push("missing:");
    for (const entry of aggregate.failedEntries.slice(0, 10)) {
      lines.push(`- ${entry.code} → ${entry.label}`);
    }
  }

  if (scopeItems.length > 1) {
    lines.push("scope:");
    for (const item of scopeItems.slice(0, 20)) {
      lines.push(
        `- ${item.code} — ${item.status} — ${item.passedChecks}/${item.totalChecks}`
      );
    }
  }

  return lines.join("\n");
}

function formatAllStagesOutput(topLevelItems, evaluatedItems, coverageMode) {
  const lines = [];

  lines.push("stage_check: all");
  lines.push(`coverage: ${coverageMode}`);

  if (!topLevelItems.length) {
    lines.push("workflow: no stages found");
    return lines.join("\n");
  }

  for (const stage of topLevelItems) {
    const scopeItems = getSubtreeItems(stage.code, evaluatedItems);
    const aggregate = aggregateScope(scopeItems);

    lines.push(
      `${stage.code} — ${aggregate.status} — ${aggregate.passedChecks}/${aggregate.totalChecks} — items:${aggregate.totalItems}`
    );
  }

  return lines.join("\n");
}

function formatCurrentOutput(topLevelItems, evaluatedItems, coverageMode) {
  const lines = [];

  lines.push("stage_check: current");
  lines.push(`coverage: ${coverageMode}`);

  for (const stage of topLevelItems) {
    const scopeItems = getSubtreeItems(stage.code, evaluatedItems);
    const aggregate = aggregateScope(scopeItems);

    if (aggregate.status !== "COMPLETE") {
      lines.push(`current: ${stage.code}`);
      lines.push(`title: ${stage.title || "(title_not_found)"}`);
      lines.push(`status: ${aggregate.status}`);
      lines.push(`scope_items: ${aggregate.totalItems}`);
      lines.push(`checks: ${aggregate.passedChecks}/${aggregate.totalChecks}`);
      return lines.join("\n");
    }
  }

  lines.push("result: all top-level stages complete");
  return lines.join("\n");
}

export async function handleStageCheck(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => ctx.bot.sendMessage(ctx.chatId, String(text ?? ""));

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const modeInfo = parseMode(ctx.rest);

  const [workflowFile, rulesFile, repoFiles] = await Promise.all([
    source.fetchTextFile(WORKFLOW_PATH),
    source.fetchTextFile(RULES_PATH),
    source.listFiles(),
  ]);

  if (!workflowFile?.content) {
    await reply(`stage_check error: cannot read ${WORKFLOW_PATH}`);
    return;
  }

  if (!rulesFile?.content) {
    await reply(`stage_check error: cannot read ${RULES_PATH}`);
    return;
  }

  const rulesJson = safeJsonParse(rulesFile.content);
  if (!rulesJson) {
    await reply(`stage_check error: invalid JSON in ${RULES_PATH}`);
    return;
  }

  const config = buildConfig(rulesJson);
  const workflowItems = parseWorkflowItems(workflowFile.content);
  const itemMap = buildItemMap(workflowItems);
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);
  const searchableFiles = sortSearchPaths(
    Array.from(fileSet).filter((p) => hasAllowedExtension(p, config)),
    config
  );

  const evaluationCtx = {
    source,
    config,
    fileSet,
    searchableFiles,
    contentCache: new Map(),
    searchCache: new Map(),
    fetchStats: { used: 0 },
    errorStats: { fetchFailures: 0 },
    itemMap,
    allItems: workflowItems,
  };

  let evaluatedItems;
  try {
    evaluatedItems = await buildEvaluatedItems(workflowItems, evaluationCtx);
  } catch (error) {
    await reply(
      `stage_check error: runtime_evaluation_failed\ncoverage: ${String(
        rulesJson?.coverage || "workflow_tree_semantic_auto_signals"
      ).trim()}`
    );
    return;
  }

  const topLevelStages = workflowItems.filter((item) => item.kind === "stage");

  const coverageMode =
    String(rulesJson?.coverage || "").trim() || "workflow_tree_semantic_auto_signals";

  if (modeInfo.mode === "all") {
    await reply(formatAllStagesOutput(topLevelStages, evaluatedItems, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_all",
    });
    return;
  }

  if (modeInfo.mode === "current") {
    await reply(formatCurrentOutput(topLevelStages, evaluatedItems, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_current",
    });
    return;
  }

  const itemCode = modeInfo.value;
  const baseItem = workflowItems.find((x) => x.code === itemCode);

  if (!baseItem) {
    await reply(
      `stage_check: ${itemCode}\nstatus: ITEM_NOT_FOUND_IN_WORKFLOW\ncoverage: ${coverageMode}`
    );
    return;
  }

  const scopeItems = getSubtreeItems(itemCode, evaluatedItems);
  const aggregate = aggregateScope(scopeItems);

  await reply(
    formatSingleItemOutput(baseItem, scopeItems, aggregate, coverageMode),
    {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_single",
    }
  );
}
