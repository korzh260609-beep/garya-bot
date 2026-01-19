// ============================================================================
// === src/bot/handlers/repoCheck.js — READ-ONLY static checks (V2, stable)
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
  // ignore property access like "ctx.handleX" or "obj.handleX"
  // NOTE: negative lookbehind requires Node 16+ (Render should be OK)
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
    // If file uses "rest" token-like, but doesn't define it as local const
    if (/\brest\b/.test(code) && !/\bconst\s+rest\s*=/.test(code)) {
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

/**
 * UNREACHABLE_CODE (V2, conservative)
 * We only flag a "return" if there's obvious same-block code after it.
 *
 * IMPORTANT: We avoid false positives for:
 * - switch/case blocks
 * - early returns in guard clauses
 * - "return ... }" followed by "case ..."
 *
 * This is NOT an AST parser by design (keep V2 simple).
 */
function findUnreachableCode(code) {
  const issues = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i] || "";
    const curTrim = cur.trim();

    // Skip comments (V2 heuristic, avoids false positives)
    if (
      curTrim.startsWith("//") ||
      curTrim.startsWith("/*") ||
      curTrim.startsWith("*") ||
      curTrim.startsWith("*/")
    ) {
      continue;
    }

    // Skip obvious string literals to reduce false positives ("return" inside text)
    if (
      (curTrim.startsWith('"') && curTrim.endsWith('"')) ||
      (curTrim.startsWith("'") && curTrim.endsWith("'")) ||
      (curTrim.startsWith("`") && curTrim.endsWith("`"))
    ) {
      continue;
    }

    if (!/\breturn\b/.test(cur)) continue;

    // If "return" is inside a switch/case style flow, skip.
    // Heuristic: look back a few lines for "case" or "switch"
    const back1 = lines[i - 1] || "";
    const back2 = lines[i - 2] || "";
    const back3 = lines[i - 3] || "";
    const backWindow = `${back1}\n${back2}\n${back3}`;
    if (
      /\bcase\s+["']\/[^"']+["']\s*:/.test(backWindow) ||
      /\bswitch\s*\(/.test(backWindow)
    ) {
      continue;
    }

    // Look ahead up to 3 lines (to allow: return -> } -> case)
    const next1 = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";
    const next3 = lines[i + 3] || "";

    const isBoundary = (line) => {
      const t = (line || "").trim();
      if (t === "") return true;
      if (/^\}\s*;?$/.test(t)) return true;
      if (/^\)\s*;?$/.test(t)) return true;
      if (/^case\s+/.test(t)) return true;
      if (/^default\s*:/.test(t)) return true;
      if (/^break\s*;?$/.test(t)) return true;
      return false;
    };

    // If immediate next is boundary, we assume no unreachable.
    // Also allow: boundary -> boundary (like: "}" then "case").
    if (isBoundary(next1)) {
      if (isBoundary(next2) || isBoundary(next3)) {
        continue;
      }
      continue;
    }

    // If next line starts a new block/case, it's boundary anyway.
    // Otherwise it's suspicious.
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

  // V1: sanitize comments + string literals to reduce false positives
  let sanitized = String(code || "");

  // remove // line comments
  sanitized = sanitized.replace(/\/\/.*$/gm, "");

  // remove /* block comments */
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, "");

  // remove string literals (rough, V1 heuristic)
  sanitized = sanitized.replace(/`[\s\S]*?`/g, "");
  sanitized = sanitized.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "");
  sanitized = sanitized.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "");

  // Simple rule example: no console.log in production code
  if (/\bconsole\.log\b/.test(sanitized)) {
    issues.push({
      code: "DECISION_VIOLATION",
      severity: "medium",
      message: "Usage of console.log violates DECISIONS.md rules.",
    });
  }

  return issues;
}

/* =========================
   SUGGESTIONS (READ-ONLY) — V1
   Rules:
   - Suggestions are derived ONLY from detected issues + rules
   - No code patches, no "insert this"
   - Max 7 items
   - Format: severity + category + reason
   ========================= */

function buildSuggestionsFromIssues(issues) {
  const map = {
    MISSING_IMPORT: {
      category: "correctness",
      reason:
        "Review referenced identifiers that appear without an import/export — because: missing imports can cause runtime failures.",
    },
    POSSIBLE_UNDEFINED_REST: {
      category: "bug",
      reason:
        "Check usage of 'rest' with ctx destructuring — because: an undefined variable can crash at runtime.",
    },
    DUPLICATE_COMMAND_CASE: {
      category: "maintainability",
      reason:
        "Ensure command cases are unique — because: duplicates can create inconsistent routing and dead branches.",
    },
    UNUSED_IMPORT: {
      category: "readability",
      reason:
        "Remove or justify unused imports — because: unused names add noise and hide real problems.",
    },
    UNREACHABLE_CODE: {
      category: "maintainability",
      reason:
        "Review early-return sections for readability — because: the unreachable-code check is heuristic and may produce noisy warnings.",
    },
    DECISION_VIOLATION: {
      category: "workflow",
      reason:
        "Align code with DECISIONS.md rules — because: violating accepted decisions breaks governance and predictability.",
    },
  };

  const rankSev = (s) => (s === "high" ? 3 : s === "medium" ? 2 : 1);

  // Deduplicate by issue.code to avoid spamming; keep highest severity occurrence.
  const byCode = new Map();
  for (const it of issues || []) {
    if (!it?.code) continue;
    const prev = byCode.get(it.code);
    if (!prev || rankSev(it.severity) > rankSev(prev.severity)) {
      byCode.set(it.code, it);
    }
  }

  const unique = Array.from(byCode.values());

  // Sort by severity desc, then stable by code
  unique.sort((a, b) => {
    const d = rankSev(b.severity) - rankSev(a.severity);
    if (d !== 0) return d;
    return String(a.code).localeCompare(String(b.code));
  });

  const suggestions = [];
  for (const it of unique) {
    const meta = map[it.code];
    if (!meta) continue;
    suggestions.push({
      severity: it.severity || "low",
      category: meta.category,
      reason: meta.reason,
      issueCode: it.code,
    });
    if (suggestions.length >= 7) break;
  }

  return suggestions;
}

/* =========================
   B3.5 HOOK — apply DECISIONS D-021 rules (noise filtering + aggregation)
   ========================= */

function applySuggestionRules({ issues, suggestions }) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  const issueList = Array.isArray(issues) ? issues : [];

  // D-021: One suggestion per issue type is already handled by dedup in buildSuggestionsFromIssues,
  // but we enforce safety here too.
  const seen = new Set();
  let unique = [];
  for (const s of list) {
    const key = String(s?.issueCode || s?.category || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }

  // D-021: Max 7
  if (unique.length > 7) unique = unique.slice(0, 7);

  // D-021: Heuristic-only noise rule for UNREACHABLE_CODE
  const onlyUnreachable =
    issueList.length > 0 &&
    issueList.every((it) => String(it?.code) === "UNREACHABLE_CODE");

  if (onlyUnreachable) {
    // Lower severity + only one item
    const base =
      unique.find((s) => String(s?.issueCode) === "UNREACHABLE_CODE") ||
      unique[0] || {
        severity: "low",
        category: "maintainability",
        reason:
          "Review early-return sections for readability — because: the unreachable-code check is heuristic and may produce noisy warnings.",
        issueCode: "UNREACHABLE_CODE",
      };

    return [
      {
        severity: "low",
        category: "maintainability",
        reason: base.reason,
      },
    ];
  }

  // D-021: If there are no high-severity issues, do not alarm.
  // (We keep severity values but do not escalate; output text remains calm by design in reasons.)
  return unique.map((s) => ({
    severity: s.severity || "low",
    category: s.category || "maintainability",
    reason: s.reason,
  }));
}

/* =========================
   B3.6 — aggregate issues for display (collapse noise)
   - keep raw issues for Suggestions logic
   - collapse display list by (code + severity)
   - add xN to message
   ========================= */

function aggregateIssuesForDisplay(issues) {
  const list = Array.isArray(issues) ? issues : [];
  const total = list.length;

  const map = new Map();
  const order = [];

  const VIS_HIDE_DETAILS_N = 10; // B3.7
  const VIS_HIDE_EXAMPLES_N = 50; // B3.7

  const pickLine = (msg) => {
    const m = String(msg || "").match(/\bline\s+(\d+)\b/i);
    return m?.[1] ? String(m[1]) : null;
  };

  for (const it of list) {
    const code = String(it?.code || "");
    const severity = String(it?.severity || "low");
    const key = `${code}__${severity}`;

    if (!map.has(key)) {
      map.set(key, {
        code,
        severity,
        message: String(it?.message || ""),
        count: 1,
        lines: [],
      });
      order.push(key);
    } else {
      map.get(key).count += 1;
    }

    const ln = pickLine(it?.message);
    if (ln) {
      const entry = map.get(key);
      if (entry.lines.length < 3 && !entry.lines.includes(ln)) {
        entry.lines.push(ln);
      }
    }
  }

  const display = order.map((key) => {
    const e = map.get(key);

    const suffixLines =
      e.lines && e.lines.length > 0 ? ` (e.g. lines ${e.lines.join(", ")})` : "";
    const suffixCount = e.count > 1 ? ` (x${e.count})` : "";

    // B3.7 visibility thresholds
    let msg;
    if (e.count >= VIS_HIDE_EXAMPLES_N) {
      // only summary
      msg = `${e.code} detected${suffixCount}`;
    } else if (e.count >= VIS_HIDE_DETAILS_N) {
      // short summary + examples
      msg = `${e.code} detected${suffixCount}${suffixLines}`;
    } else {
      // normal (detailed) message
      msg = `${e.message}${suffixCount}${suffixLines}`;
    }

    return { code: e.code, severity: e.severity, message: msg };
  });

  const collapsed = total - display.length;

  return { total, collapsed, display };
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

  // V1: missing handler imports (only for bare identifiers, not ctx.handleX)
  const imported = extractImportedNames(code);
  const usedHandles = findUsedHandles(code);

  for (const h of usedHandles) {
    const selfDefined = new RegExp(
      `\\bfunction\\s+${h}\\b|\\bconst\\s+${h}\\b|\\blet\\s+${h}\\b|\\bvar\\s+${h}\\b|\\bexport\\s+(async\\s+)?function\\s+${h}\\b`
    ).test(code);

    // Allow "ctx.handleX" style usage (already excluded by regex, but keep safe)
    const asProperty = new RegExp(`\\b[A-Za-z_$][A-Za-z0-9_$]*\\.${h}\\b`).test(
      code
    );

    if (!selfDefined && !imported.has(h) && !asProperty) {
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

  // B3.6/B3.7: collapse issues for display only (keep raw issues for Suggestions logic)
  const displayAgg = aggregateIssuesForDisplay(issues);
  const displayIssues = displayAgg.display;

  // Output
  const out = [];
  out.push(`repo_check: ${path}`);

  out.push("");
  out.push("Suggestions (READ-ONLY):");

  // B3.5 — Suggestions enabled with D-021 filtering
  const rawSuggestions = buildSuggestionsFromIssues(issues);
  const suggestions = applySuggestionRules({ issues, suggestions: rawSuggestions });

  if (!suggestions || suggestions.length === 0) {
    out.push("- (none)");
  } else {
    suggestions.forEach((s) => {
      out.push(`- [${s.severity}] [${s.category}] ${s.reason}`);
    });
  }

  if (issues.length === 0) {
    out.push("");
    out.push("OK: no issues detected by V2 checks.");
    await bot.sendMessage(chatId, out.join("\n"));
    return;
  }

  const bySevDisplay = displayIssues.reduce(
    (acc, it) => {
      acc[it.severity] = (acc[it.severity] || 0) + 1;
      return acc;
    },
    {}
  );

  const collapsedNote =
    displayAgg.collapsed > 0
      ? ` [collapsed from ${displayAgg.total}]`
      : "";

  out.push(
    `issues: ${displayIssues.length} (high=${bySevDisplay.high || 0}, medium=${
      bySevDisplay.medium || 0
    }, low=${bySevDisplay.low || 0})${collapsedNote}`
  );

  displayIssues.slice(0, 15).forEach((it, i) => {
    out.push(`${i + 1}) [${it.severity}] ${it.code}: ${it.message}`);
  });

  if (displayIssues.length > 15) {
    out.push(`...and ${displayIssues.length - 15} more`);
  }

  await bot.sendMessage(chatId, out.join("\n"));
}
