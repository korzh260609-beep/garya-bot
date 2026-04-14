// ============================================================================
// === src/bot/handlers/stage-check/extractors.js
// ============================================================================

import { uniq } from "./common.js";
import {
  FUNCTION_NAME_BLOCKLIST,
  SIMPLE_ARG_BLOCKLIST,
  isUsefulToken,
} from "./classification.js";
import { buildConceptualVariants } from "./morphology.js";

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

function looksLikeCodeishArgument(arg) {
  const raw = String(arg || "").trim();
  if (!raw) return true;

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return true;
  if (/^["'`].*["'`]$/.test(raw)) return true;
  if (/^\d+$/.test(raw)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*.+$/.test(raw)) return true;
  if (/[{}\[\]."'`=_:-]/.test(raw)) return true;

  return false;
}

function isTechnicalFunctionArgToken(arg) {
  const raw = String(arg || "").trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();

  if (SIMPLE_ARG_BLOCKLIST.has(lower)) return false;
  if (raw.includes("_")) return true;
  if (raw.includes("-")) return true;
  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return true;

  return false;
}

function isLikelyFunctionName(fnName) {
  const raw = String(fnName || "").trim();
  if (!raw) return false;
  if (FUNCTION_NAME_BLOCKLIST.has(raw)) return false;
  if (/^[A-Z0-9_]+$/.test(raw) && !/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw)) {
    return false;
  }
  return true;
}

export function extractFunctionLikeTokens(text) {
  const source = String(text || "");
  const out = [];
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)/g;

  let hit;
  while ((hit = re.exec(source))) {
    const fnName = String(hit[1] || "").trim();
    const argsRaw = String(hit[2] || "").trim();

    if (!fnName || !isLikelyFunctionName(fnName)) continue;

    if (argsRaw) {
      const parts = argsRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const allCodeish = parts.length > 0 && parts.every(looksLikeCodeishArgument);
      if (!allCodeish) continue;
    }

    out.push(fnName);
    out.push(`${fnName}(`);

    if (argsRaw) {
      out.push(`${fnName}(${argsRaw})`);
    }

    const args = argsRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const arg of args) {
      if (isTechnicalFunctionArgToken(arg)) {
        out.push(arg);
      }
    }
  }

  return uniq(out);
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

export function extractDefinitionUsageSignals(text, config) {
  const out = [];
  const fnTokens = extractFunctionLikeTokens(text);

  for (const token of fnTokens) {
    out.push(token);
    out.push(...buildConceptualVariants(token, config));
  }

  return uniq(out).filter((token) => isUsefulToken(token, config));
}