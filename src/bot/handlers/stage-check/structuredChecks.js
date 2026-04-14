// ============================================================================
// === src/bot/handlers/stage-check/structuredChecks.js
// ============================================================================

import { uniq, normalizeItemCode } from "./common.js";
import { getAncestorChain } from "./workflowParser.js";

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