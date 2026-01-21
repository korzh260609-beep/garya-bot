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

// =========================
// B5.0 (Skeleton): zone-aware architecture review (DISABLED by default)
// Enable later via env: SG_REPO_REVIEW_B5=1
// =========================
const B5_ENABLED = String(process.env.SG_REPO_REVIEW_B5 || "") === "1";

// =========================
// B5.1 (Config): token / regex matchers (NO LOGIC YET)
// =========================

// Direct AI calls must go via router
const B5_DIRECT_AI_PATTERNS = [
  /\bopenai\b/i,
  /\bchat\.completions\b/i,
  /\bresponses\.create\b/i,
  /\bclient\.responses\.create\b/i,
  /\bcreateChatCompletion\b/i,
];

// Privileged actions must have permission checks
const B5_PERMISSION_TOKENS = [
  "can(",
  "requireMonarch",
  "requirePermission",
  "assertAccess",
  "ensureAccess",
];

// Memory policy risks: raw or direct writes
const B5_MEMORY_WRITE_PATTERNS = [
  /\bchat_memory\b/i,
  /\bproject_memory\b/i,
  /\bMemoryService\b/i,
  /\bstoreMemory\b/i,
  /\bwriteMemory\b/i,
  /\binsert\s+into\s+chat_memory\b/i,
];

// Boundary heuristics (handlers / transport must stay thin)
const B5_BOUNDARY_RISK_PATTERNS = {
  db: [
    /\bpool\.query\b/i,
    /\bdb\.query\b/i,
    /\binsert\s+into\b/i,
    /\bupdate\s+\w+\b/i,
  ],
  http: [
    /\bfetch\(/i,
    /\baxios\b/i,
    /\brequest\(/i,
  ],
  ai: B5_DIRECT_AI_PATTERNS,
};

// Observability expectations (AI cost + reason)
const B5_LOGGING_TOKENS = [
  "logAi",
  "ai_usage",
  "usage_log",
  "cost",
  "reason",
];

// Helper (used later in B5.2)
function b5ContainsAny(code, tokens) {
  const s = String(code || "");
  return tokens.some((t) =>
    typeof t === "string" ? s.includes(t) : t.test(s)
  );
}

function classifyZone(filePath) {
  const p = String(filePath || "");
  if (p.startsWith("src/http/") || p.startsWith("src/bootstrap/")) return "transport_core";
  if (p.startsWith("src/bot/handlers/")) return "handlers";
  if (p.startsWith("src/bot/")) return "bot";
  if (p.startsWith("src/sources/")) return "sources";
  if (p.startsWith("src/repo/")) return "repo";
  if (p.startsWith("src/memory/") || p.startsWith("core/")) return "memory_core";
  if (!p.includes("/") && p.endsWith(".js")) return "root";
  return "other";
}

// B5 issue codes (logic will be added in B5.2)
function detectDirectAiCallRisk(_code, _path) { return []; }
function detectPermissionBypassRisk(_code, _path) { return []; }
function detectMemoryPolicyRisk(_code, _path) { return []; }
function detectCoreBoundaryViolations(_code, _path) { return []; }
function detectObservabilityGap(_code, _path) { return []; }

function collectB5Issues(code, path) {
  const zone = classifyZone(path);
  void zone; // reserved for B5.2 logic

  return [
    ...detectDirectAiCallRisk(code, path),
    ...detectPermissionBypassRisk(code, path),
    ...detectMemoryPolicyRisk(code, path),
    ...detectCoreBoundaryViolations(code, path),
    ...detectObservabilityGap(code, path),
  ];
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

    const asProperty = new RegExp(`\\b[A-Za-z_$][A-Za-z0-9_$]*\\.${h}\\b`).test(code);

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

    if (isBoundary(next1) && (isBoundary(next2) || isBoundary(next3))) continue;

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
      reason: "Verify missing imports — missing imports cause runtime failures.",
    },
    UNREACHABLE_CODE: {
      category: "maintainability",
      reason: "Review early-return blocks — unreachable-code is heuristic.",
    },
    DECISION_VIOLATION: {
      category: "workflow",
      reason: "Align code with DECISIONS.md rules.",
    },
  };

  const list = Object.values(agg || {}).sort((a, b) => {
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

  const files = (await source.listFiles()) || [];

  const candidates = files.filter((p) => {
    if (!p) return false;
    if (p.startsWith("pillars/")) return false;
    if (!p.endsWith(".js")) return false;
    if (p.startsWith("src/")) return true;
    if (!p.includes("/")) return true;
    return false;
  });

  const batch = candidates.slice(0, limit);

  const agg = {};
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

    if (B5_ENABLED) {
      issues.push(...collectB5Issues(code, path));
    }

    for (const it of issues) {
      applyHeuristicPolicy(it, path);

      const key = `${it.code}__${it.severity}`;
      typeSet.add(it.code);

      if (!agg[key]) {
        agg[key] = { code: it.code, severity: it.severity, count: 0, examples: [] };
      }

      agg[key].count += 1;
      if (agg[key].examples.length < 3) agg[key].examples.push(path);
      if (bySev[it.severity] !== undefined) bySev[it.severity] += 1;
    }
  }

  const suggestions =
    bySev.high > 0 || typeSet.size >= 2
      ? buildSuggestionsFromAggregated(agg)
      : [];

  const out = [];
  out.push("repo_review: repo-level (READ-ONLY)");
  out.push(`scanned: ${filesScanned}/${batch.length} (limit=${limit})`);
  out.push("");

  out.push("Suggestions:");
  suggestions.length
    ? suggestions.forEach((s) =>
        out.push(`- [${s.severity}] [${s.category}] ${s.reason}`)
      )
    : out.push("- (none)");

  out.push("");
  out.push(`issues: high=${bySev.high}, medium=${bySev.medium}, low=${bySev.low}`);

  await bot.sendMessage(chatId, out.join("\n"));
}
