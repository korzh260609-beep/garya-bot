// ============================================================================
// === src/bot/handlers/repoCheck.js — READ-ONLY static checks (no fixes)
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

function denySensitivePath(path) {
  const lower = String(path || "").toLowerCase();
  return (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("key")
  );
}

function extractImportedNames(code) {
  const imported = new Set();

  // import { a, b as c } from "..."
  const reNamed = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["'][^"']+["'];/g;
  let m;
  while ((m = reNamed.exec(code))) {
    const inside = m[1] || "";
    inside
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part) => {
        // "b as c" => take c
        const asMatch = part.match(/\bas\b\s+([A-Za-z0-9_$]+)/);
        if (asMatch?.[1]) imported.add(asMatch[1]);
        else imported.add(part.replace(/\s+/g, ""));
      });
  }

  // import X from "..."
  const reDefault = /import\s+([A-Za-z0-9_$]+)\s+from\s+["'][^"']+["'];/g;
  while ((m = reDefault.exec(code))) {
    if (m[1]) imported.add(m[1]);
  }

  // import * as X from "..."
  const reStar = /import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+["'][^"']+["'];/g;
  while ((m = reStar.exec(code))) {
    if (m[1]) imported.add(m[1]);
  }

  return imported;
}

function findUsedHandles(code) {
  const used = new Set();
  // naive: any identifier starting with handle + Capital
  const re = /\b(handle[A-Z][A-Za-z0-9_$]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) used.add(m[1]);
  }
  return used;
}

function findUndefinedRestBug(code) {
  // Detect "const { bot, chatId } = ctx;" + later uses "rest" (without ctx.rest)
  // and handler call includes "rest," but "rest" not defined in scope.
  const issues = [];
  const hasCtxDestructureNoRest =
    /const\s*\{\s*bot\s*,\s*chatId[^}]*\}\s*=\s*ctx\s*;/.test(code) &&
    !/const\s*\{[^}]*\brest\b[^}]*\}\s*=\s*ctx\s*;/.test(code);

  if (hasCtxDestructureNoRest) {
    // If somewhere "rest," appears as an argument, flag it
    if (/\brest\s*,/.test(code) && !/\bconst\s+rest\s*=/.test(code)) {
      issues.push({
        code: "POSSIBLE_UNDEFINED_REST",
        severity: "high",
        message:
          "Possible bug: 'rest' is used but not defined (expected ctx.rest or destructure rest from ctx).",
      });
    }
  }
  return issues;
}

function findDuplicateCases(code) {
  const issues = [];
  const re = /\bcase\s+["'](\/[^"']+)["']\s*:/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(code))) {
    const cmd = m[1];
    if (!cmd) continue;
    const count = (seen.get(cmd) || 0) + 1;
    seen.set(cmd, count);
  }
  for (const [cmd, count] of seen.entries()) {
    if (count > 1) {
      issues.push({
        code: "DUPLICATE_COMMAND_CASE",
        severity: "medium",
        message: `Duplicate switch case for command '${cmd}' (${count} occurrences).`,
      });
    }
  }
  return issues;
}

export async function handleRepoCheck({ bot, chatId, rest }) {
  const path = (rest || "").trim();

  if (!path) {
    await bot.sendMessage(chatId, "Usage: /repo_check <path/to/file.js>");
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, "Access denied: sensitive file.");
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const file = await source.fetchTextFile(path);

  if (!file || typeof file.content !== "string") {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  const code = file.content;

  const issues = [];

  // 1) Missing imports for handleX usages (common refactor regression)
  const imported = extractImportedNames(code);
  const usedHandles = findUsedHandles(code);

  for (const h of usedHandles) {
    // Allow self definition: "export async function handleX"
    const selfDefined = new RegExp(`\\bfunction\\s+${h}\\b|\\bconst\\s+${h}\\b|\\bexport\\s+function\\s+${h}\\b|\\bexport\\s+async\\s+function\\s+${h}\\b`).test(
      code
    );
    if (!selfDefined && !imported.has(h)) {
      issues.push({
        code: "MISSING_IMPORT",
        severity: "high",
        message: `Identifier '${h}' is used but not imported in this file.`,
      });
    }
  }

  // 2) Undefined 'rest' pattern (your repo already had a similar risk)
  issues.push(...findUndefinedRestBug(code));

  // 3) Duplicate command cases (switch)
  issues.push(...findDuplicateCases(code));

  // Output (compact)
  const lines = [];
  lines.push(`repo_check: ${path}`);
  if (issues.length === 0) {
    lines.push(`OK: no issues detected by V1 checks.`);
    await bot.sendMessage(chatId, lines.join("\n"));
    return;
  }

  const bySev = issues.reduce(
    (acc, it) => {
      acc[it.severity] = (acc[it.severity] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  lines.push(`issues: ${issues.length} (high=${bySev.high || 0}, medium=${bySev.medium || 0}, low=${bySev.low || 0})`);

  const top = issues.slice(0, 15);
  for (let i = 0; i < top.length; i += 1) {
    const it = top[i];
    lines.push(`${i + 1}) [${it.severity}] ${it.code}: ${it.message}`);
  }

  if (issues.length > top.length) {
    lines.push(`...and ${issues.length - top.length} more`);
  }

  await bot.sendMessage(chatId, lines.join("\n"));
}

