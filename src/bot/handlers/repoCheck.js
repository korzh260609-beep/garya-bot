// ============================================================================
// === src/bot/handlers/repoCheck.js — READ-ONLY static checks (V2)
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

/* =========================
   IMPORT / USAGE ANALYSIS
   ========================= */

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

function extractUsedIdentifiers(code) {
  const used = new Set();
  const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) used.add(m[1]);
  }
  return used;
}

function findUsedHandles(code) {
  const used = new Set();
  // ignore property access like "ctx.handleX"
  const re = /(?<!\.)\b(handle[A-Z][A-Za-z0-9_$]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) used.add(m[1]);
  }
  return used;
}

/* =========================
   BUG PATTERNS
   ========================= */

function findUndefinedRestBug(code) {
  const issues = [];
  const hasCtxDestructureNoRest =
    /const\s*\{\s*bot\s*,\s*chatId[^}]*\}\s*=\s*ctx\s*;/.test(code) &&
    !/const\s*\{[^}]*\brest\b[^}]*\}\s*=\s*ctx\s*;/.test(code);

  if (hasCtxDestructureNoRest) {
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
    seen.set(cmd, (seen.get(cmd) || 0) + 1);
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

function findUnusedImports(code) {
  const issues = [];
  const imported = extractImportedNames(code);
  const used = extractUsedIdentifiers(code);

  for (const name of imported) {
    if (!used.has(name)) {
      issues.push({
        code: "UNUSED_IMPORT",
        severity: "low",
        message: `Imported '${name}' is never used.`,
      });
    }
  }
  return issues;
}

function findUnreachableCode(code) {
  const issues = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    if (!/\breturn\b/.test(lines[i])) continue;

    const next = (lines[i + 1] || "").trim();

    // Allowed control-flow boundaries
    if (
      next === "" ||
      next === "}" ||
      next.startsWith("case ") ||
      next === "default:" ||
      next === "break;" ||
      next === "break"
    ) {
      continue;
    }

    issues.push({
      code: "UNREACHABLE_CODE",
      severity: "medium",
      message: `Possible unreachable code after 'return' at line ${i + 2}.`,
    });
  }

  return issues;
}

/* =========================
   DECISIONS.md RULES (V1)
   ========================= */

function checkDecisionsViolations(code) {
  const issues = [];

  // Rule example: no console.log in production code
  if (/\bconsole\.log\b/.test(code)) {
    issues.push({
      code: "DECISION_VIOLATION",
      severity: "medium",
      message: "Usage of console.log violates DECISIONS.md rules.",
    });
  }

  return issues;
}

/* =========================
   MAIN HANDLER
   ========================= */

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

  // V1
  const imported = extractImportedNames(code);
  const usedHandles = findUsedHandles(code);

  for (const h of usedHandles) {
    const selfDefined = new RegExp(
      `\\bfunction\\s+${h}\\b|\\bconst\\s+${h}\\b|\\bexport\\s+(async\\s+)?function\\s+${h}\\b`
    ).test(code);

    if (!selfDefined && !imported.has(h)) {
      issues.push({
        code: "MISSING_IMPORT",
        severity: "high",
        message: `Identifier '${h}' is used but not imported in this file.`,
      });
    }
  }

  issues.push(...findUndefinedRestBug(code));
  issues.push(...findDuplicateCases(code));

  // V2
  issues.push(...findUnusedImports(code));
  issues.push(...findUnreachableCode(code));
  issues.push(...checkDecisionsViolations(code));

  // Output
  const lines = [];
  lines.push(`repo_check: ${path}`);

  if (issues.length === 0) {
    lines.push("OK: no issues detected by V2 checks.");
    await bot.sendMessage(chatId, lines.join("\n"));
    return;
  }

  const bySev = issues.reduce(
    (acc, it) => {
      acc[it.severity] = (acc[it.severity] || 0) + 1;
      return acc;
    },
    {}
  );

  lines.push(
    `issues: ${issues.length} (high=${bySev.high || 0}, medium=${bySev.medium || 0}, low=${bySev.low || 0})`
  );

  issues.slice(0, 15).forEach((it, i) => {
    lines.push(`${i + 1}) [${it.severity}] ${it.code}: ${it.message}`);
  });

  if (issues.length > 15) {
    lines.push(`...and ${issues.length - 15} more`);
  }

  await bot.sendMessage(chatId, lines.join("\n"));
}
