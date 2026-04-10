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

function isAllUppercaseWord(token) {
  return /^[A-Z][A-Z0-9_-]+$/.test(String(token || ""));
}

export function isUsefulToken(token, config) {
  const raw = String(token || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (config.stopTokens.has(lower)) return false;
  if (config.basenameBlocklist.has(lower)) return false;
  if (config.genericUppercaseWords.has(lower)) return false;
  if (lower.length < config.minIdentifierLength) return false;

  if (/^[0-9.]+$/.test(lower)) return false;
  if (/^[a-z]$/.test(lower)) return false;
  if (/^[ivxlcdm]+$/i.test(lower)) return false;

  if (isAllUppercaseWord(raw) && !raw.includes("_")) {
    return false;
  }

  return true;
}

export function extractIdentifiers(text, config) {
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

export function canGenerateBasenameFromSignal(token, config) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return false;
  if (!isPascalCaseToken(raw)) return false;
  if (config.basenameBlocklist.has(lower)) return false;

  return config.basenameSignalSuffixes.some((suffix) => raw.endsWith(suffix));
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

export function collectOwnSignals(item, config) {
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

  return {
    explicitPaths: uniq([...ownPaths, ...ownBacktickPaths]),
    commands: uniq([...ownCommands, ...ownBacktickCommands.map((x) => x.toLowerCase())]),
    signals: uniq([
      ...ownIdentifiers,
      ...ownSlashList,
      ...ownBacktickIdentifiers,
    ]).filter((token) => isUsefulToken(token, config)),
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
    ]);

    for (const token of tokens) {
      if (canGenerateBasenameFromSignal(token, config) || isUsefulToken(token, config)) {
        ancestorSignals.push(token);
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
            : `text:${String(check.token || "").toLowerCase()}`;

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
      });
    }

    return normalChecks.slice(0, config.maxChecksPerItem);
  }

  for (const structuredCheck of structuredChecks) {
    pushCheck(priorityChecks, structuredCheck);
  }

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
    });
  }

  for (const token of own.signals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `signal token: ${token}`,
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for signal: ${basename}`,
        });
      }
    }
  }

  for (const token of inheritedSignals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `inherited signal: ${token}`,
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for inherited signal: ${basename}`,
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