// ============================================================================
// === src/bot/handlers/repoReview.js — Repo-level review (READ-ONLY, B4)
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

// ---------------------------------------------------------------------------
// Small arg parser (no dependencies)
// Usage examples:
// /repo_review
// /repo_review 30
// /repo_review --limit=40
// ---------------------------------------------------------------------------
function parseArgs(rest) {
  const raw = String(rest || "").trim();
  const tokens = raw ? raw.split(/\s+/g) : [];

  let limit = 30;

  for (const t of tokens) {
    if (/^\d+$/.test(t)) limit = Number(t);
    const m = t.match(/^--limit=(\d+)$/);
    if (m?.[1]) limit = Number(m[1]);
  }

  limit = Math.max(5, Math.min(limit || 30, 60)); // safety caps
  return { limit };
}

function severityRank(s) {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function applyHeuristicPolicy(issue, filePath) {
  const code = String(issue?.code || "");
  if (code !== "UNREACHABLE_CODE") return;

  const p = String(filePath || "");

  const allowed =
    p.startsWith("src/bot/handlers/") ||
    p.startsWith("src/sources/") ||
    p === "classifier.js";

  if (allowed) {
    // User decision: heuristic / non-blocking / aggregate-only
    issue.severity = "low";
  }
}

/* =========================
   Minimal checks (copied logic style from repoCheck.js)
   Keep READ-ONLY. No AST.
   ========================= */

function extractImportedNames(code) {
  const imported = new Set();

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

  const reDefault = /import\s+([A-Za-z0-9_$]+)\s+from\s+["'][^"']+["'];/g;
  while ((m = reDefault.exec(code))) {
    if (m[1]) imported.add(m[1]);
  }

  const reStar = /import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+["'][^"']+["'];/g;
  while ((m = reStar.exec(code))) {
    if (m[1]) imported.add(m[1]);
  }

  return imported;
}

function findUsedHandles(code) {
  const used = new Set();
  const re = /(?<!\.)\b(handle[A-Z][A-Za-z0-9_$]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) used.add(m[1]);
  }
  return used;
}

function findMissingImportsForHandles(code) {
  const issues = [];
  const imported = extractImportedNames(code);
  const usedHandles = findUsedHandles(code);

  for (const h of usedHandles) {
    const selfDefined = new RegExp(
      `\\bfunction\\s+${h}\\b|\\bconst\\s+${h}\\b|\\blet\\s+${h}\\b|\\bvar\\s+${h}\\b|\\bexport\\s+(async\\s+)?function\\s+${h}\\b`
    ).test(code);

    const asProperty = new RegExp(`\\b[A-Za-z_$][A-Za-z0-9_$]*\\.${h}\\b`).test(
      code
    );

    if (!selfDefined && !imported.has(h) && !asProperty) {
      issues.push({
        code: "MISSING_IMPORT",
        severity: "high",
        message: `Identifier '${h}' is used but not imported.`,
      });
    }
  }

  return issues;
}

function findUnreachableCode(code) {
  const issues = [];
  const lines = String(code || "").split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i] || "";
    const curTrim = cur.trim();

    if (
      curTrim.startsWith("//") ||
      curTrim.startsWith("/*") ||
      curTrim.startsWith("*") ||
      curTrim.startsWith("*/")
    ) {
      continue;
    }

    if (!/\breturn\b/.test(cur)) continue;

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

    if (isBoundary(next1)) {
      if (isBoundary(next2) || isBoundary(next3)) continue;
      continue;
    }

    issues.push({
      code: "UNREACHABLE_CODE",
      severity: "medium",
      message: `Possible unreachable code after 'return' near line ${i + 2}.`,
    });
  }

  return issues;
}

function checkDecisionsViolations(code) {
  const issues = [];

  let sanitized = String(code || "");
  sanitized = sanitized.replace(/\/\/.*$/gm, "");
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, "");
  sanitized = sanitized.replace(/`[\s\S]*?`/g, "");
  sanitized = sanitized.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "");
  sanitized = sanitized.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "");

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
   Suggestions (READ-ONLY) — STRICT GATE (B3.9) at repo-level
   ========================= */

function buildSuggestionsFromAggregated(agg) {
  const map = {
    MISSING_IMPORT: {
      category: "bug",
      reason:
        "Verify missing imports for used handlers — because: missing imports can cause runtime failures.",
    },
    UNREACHABLE_CODE: {
      category: "maintainability",
      reason:
        "Review early-return blocks for clarity — because: unreachable-code checks are heuristic and may be noisy.",
    },
    DECISION_VIOLATION: {
      category: "workflow",
      reason:
        "Align code with DECISIONS.md rules — because: violating accepted decisions breaks predictability.",
    },
  };

  const list = Object.keys(agg || {})
    .map((k) => agg[k])
    .filter(Boolean)
    .sort((a, b) => {
      const d = severityRank(b.severity) - severityRank(a.severity);
      if (d !== 0) return d;
      return (b.count || 0) - (a.count || 0);
    });

  const suggestions = [];
  for (const it of list) {
    const meta = map[it.code];
    if (!meta) continue;
    suggestions.push({
      severity: it.severity,
      category: meta.category,
      reason: meta.reason,
    });
    if (suggestions.length >= 7) break;
  }

  return suggestions;
}

export async function handleRepoReview({ bot, chatId, rest }) {
  const { limit } = parseArgs(rest);

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const allFiles = await source.listFiles();
  const files = Array.isArray(allFiles) ? allFiles : [];

  // Scope: only JS in src/ and root *.js (safe default)
  const candidates = files.filter((p) => {
    if (!p) return false;
    if (p.startsWith("pillars/")) return false;
    if (!p.endsWith(".js")) return false;
    if (p.startsWith("src/")) return true;
    if (!p.includes("/")) return true; // root js
    return false;
  });

  const batch = candidates.slice(0, limit);

  const agg = {}; // key = code__severity
  const bySev = { high: 0, medium: 0, low: 0 };
  const typeSet = new Set();
  let filesScanned = 0;

  for (const path of batch) {
    const item = await source.fetchTextFile(path);
    if (!item || typeof item.content !== "string") continue;

    filesScanned += 1;
    const code = item.content;

    const issues = [];
    issues.push(...findMissingImportsForHandles(code));
    issues.push(...findUnreachableCode(code));
    issues.push(...checkDecisionsViolations(code));

    for (const it of issues) {
  applyHeuristicPolicy(it, path);

  const codeKey = String(it.code || "");
      const sev = String(it.severity || "low");
      const key = `${codeKey}__${sev}`;
      typeSet.add(codeKey);

      if (!agg[key]) {
        agg[key] = {
          code: codeKey,
          severity: sev,
          count: 0,
          examples: [],
        };
      }
      agg[key].count += 1;

      if (agg[key].examples.length < 3 && !agg[key].examples.includes(path)) {
        agg[key].examples.push(path);
      }

      if (bySev[sev] !== undefined) bySev[sev] += 1;
    }
  }

  const hasHigh = bySev.high > 0;
  const hasMultipleTypes = typeSet.size >= 2;

  // B3.9 strict gate (repo-level)
  const suggestions = hasHigh || hasMultipleTypes
    ? buildSuggestionsFromAggregated(agg)
    : [];

  const out = [];
  out.push(`repo_review: repo-level (READ-ONLY)`);
  out.push(`scope: src/**/*.js + root *.js`);
  out.push(`filesListed: ${files.length}`);
  out.push(`candidates: ${candidates.length}`);
  out.push(`scanned: ${filesScanned}/${batch.length} (limit=${limit})`);
  out.push("");

  out.push("Suggestions (READ-ONLY):");
  if (!suggestions.length) {
    out.push("- (none)");
  } else {
    for (const s of suggestions) {
      out.push(`- [${s.severity}] [${s.category}] ${s.reason}`);
    }
  }

  out.push("");
  out.push(
    `issues: (high=${bySev.high}, medium=${bySev.medium}, low=${bySev.low})`
  );

  // Top issue buckets
  const buckets = Object.values(agg)
    .sort((a, b) => {
      const d = severityRank(b.severity) - severityRank(a.severity);
      if (d !== 0) return d;
      return (b.count || 0) - (a.count || 0);
    })
    .slice(0, 10);

  if (!buckets.length) {
    out.push("top: (none)");
  } else {
    out.push("top:");
    buckets.forEach((b, i) => {
      const ex = b.examples?.length ? ` | e.g. ${b.examples.join(", ")}` : "";
      out.push(`${i + 1}) [${b.severity}] ${b.code} (x${b.count})${ex}`);
    });
  }

  await bot.sendMessage(chatId, out.join("\n"));
}

