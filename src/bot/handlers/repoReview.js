// ============================================================================
// === src/bot/handlers/repoReview.js — Repo-level review (READ-ONLY, B4/B5)
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
// Enable via env: SG_REPO_REVIEW_B5=1
// =========================
const B5_ENABLED = String(process.env.SG_REPO_REVIEW_B5 || "") === "1";

// =========================
// B5.1 (Config): token / regex matchers
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
  http: [/\bfetch\(/i, /\baxios\b/i, /\brequest\(/i],
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

// Helper
function b5ContainsAny(code, tokens) {
  const s = String(code || "");
  return tokens.some((t) => (typeof t === "string" ? s.includes(t) : t.test(s)));
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

// =========================
// B5.3 (Config): allowlist / suppressions (config-only)
// =========================

// UNREACHABLE_CODE — suppress paths where it is expected noise
const B5_UNREACHABLE_SUPPRESS_PATHS = [
  /^classifier\.js$/i,
  /^src\/bot\/handlers\/.+\.js$/i,
  // If you later want sources too, add:
  // /^src\/sources\/.+\.js$/i,
];

// DECISION_VIOLATION — suppress only for specific files (keep it narrow)
const B5_DECISION_SUPPRESS_PATHS = [
  /^src\/bootstrap\/initSystem\.js$/i,
];

const B5_DECISION_SUPPRESS_TOKENS = [
  /\bconsole\.log\b/i,
];

function b5PathMatches(path, rules) {
  const p = String(path || "");
  return rules.some((r) => r.test(p));
}

// =========================
// B5.2 (Logic): detections (READ-ONLY)
// =========================

// Remove strings and comments to reduce false positives
function b5Sanitize(code) {
  let s = String(code || "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, " "); // block comments
  s = s.replace(/\/\/.*$/gm, " "); // line comments
  s = s.replace(/`[\s\S]*?`/g, " "); // template strings
  s = s.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, " "); // double strings
  s = s.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, " "); // single strings
  return s;
}

// B5: DIRECT_AI_CALL (high) — heuristic
// We flag when code mentions OpenAI SDK style tokens AND does not use callAI/router wrapper.
function detectDirectAiCallRisk(code, path) {
  const issues = [];
  const zone = classifyZone(path);
  const s = b5Sanitize(code);

  const mentionsDirectAi = b5ContainsAny(s, B5_DIRECT_AI_PATTERNS);
  if (!mentionsDirectAi) return issues;

  // allowlist heuristic: if file uses wrapper callAI, treat as not direct call
  const usesWrapper =
    /\bcallAI\s*\(/.test(s) ||
    /\baiRouter\b/i.test(s) ||
    /\bAIRouter\b/.test(s);

  if (!usesWrapper) {
    issues.push({
      code: "DIRECT_AI_CALL",
      severity: zone === "transport_core" ? "high" : "high",
      message: "Possible direct AI/SDK call detected (must go via router/wrapper).",
    });
  }

  return issues;
}

// B5: PERMISSION_BYPASS_RISK (high) — heuristic on privileged commands/handlers
function detectPermissionBypassRisk(code, path) {
  const issues = [];
  const p = String(path || "");
  const s = b5Sanitize(code);

  const privilegedByName =
    /admin/i.test(p) ||
    /stop_/i.test(p) ||
    /start_/i.test(p) ||
    /pm_set/i.test(p) ||
    /reindex/i.test(p) ||
    /repo_/i.test(p);

  if (!privilegedByName) return issues;

  const hasPermissionCheck = b5ContainsAny(s, B5_PERMISSION_TOKENS);

  if (!hasPermissionCheck) {
    issues.push({
      code: "PERMISSION_BYPASS_RISK",
      severity: "high",
      message: "Privileged handler/command may lack an explicit permission check.",
    });
  }

  return issues;
}

// B5: MEMORY_POLICY_RISK (high/medium) — writing memory outside memory_core zone
function detectMemoryPolicyRisk(code, path) {
  const issues = [];
  const zone = classifyZone(path);
  const s = b5Sanitize(code);

  const mentionsMemoryWrite = b5ContainsAny(s, B5_MEMORY_WRITE_PATTERNS);
  if (!mentionsMemoryWrite) return issues;

  if (zone !== "memory_core") {
    issues.push({
      code: "MEMORY_POLICY_RISK",
      severity: zone === "transport_core" ? "high" : "medium",
      message: "Memory write/reference detected outside memory_core (verify MemoryPolicy boundaries).",
    });
  }

  return issues;
}

// B5: CORE_BOUNDARY_VIOLATION (medium/high) — heavy responsibilities in thin zones
function detectCoreBoundaryViolations(code, path) {
  const issues = [];
  const zone = classifyZone(path);
  const s = b5Sanitize(code);

  const dbRisk = b5ContainsAny(s, B5_BOUNDARY_RISK_PATTERNS.db);
  const httpRisk = b5ContainsAny(s, B5_BOUNDARY_RISK_PATTERNS.http);
  const aiRisk = b5ContainsAny(s, B5_BOUNDARY_RISK_PATTERNS.ai);

  if (zone === "transport_core") {
    if (dbRisk || aiRisk) {
      issues.push({
        code: "CORE_BOUNDARY_VIOLATION",
        severity: "high",
        message: "Transport core should be thin; DB/AI responsibility detected.",
      });
    }
    return issues;
  }

  if (zone === "handlers") {
    if (dbRisk || aiRisk) {
      issues.push({
        code: "CORE_BOUNDARY_VIOLATION",
        severity: "medium",
        message: "Handlers should be thin; DB/AI responsibility detected (consider delegating to services).",
      });
    }
    return issues;
  }

  if (zone === "sources") {
    // sources often do HTTP; DB/AI inside sources is suspicious
    if (dbRisk || aiRisk) {
      issues.push({
        code: "CORE_BOUNDARY_VIOLATION",
        severity: "medium",
        message: "Sources should not contain DB/AI responsibility (verify Sources layer boundaries).",
      });
    }
    // httpRisk is not flagged in sources (normal)
    return issues;
  }

  // other zones: no boundary verdicts (avoid noise)
  void httpRisk;
  return issues;
}

// B5: OBSERVABILITY_GAP (medium) — AI usage without obvious logging tokens nearby (heuristic)
function detectObservabilityGap(code, path) {
  const issues = [];
  const zone = classifyZone(path);
  const s = b5Sanitize(code);

  // If wrapper is used, expect some logging token around.
  const usesAiWrapper = /\bcallAI\s*\(/.test(s);
  if (!usesAiWrapper) return issues;

  const hasLogging = b5ContainsAny(s, B5_LOGGING_TOKENS);
  if (!hasLogging) {
    issues.push({
      code: "OBSERVABILITY_GAP",
      severity: zone === "transport_core" ? "high" : "medium",
      message: "AI call wrapper detected without obvious cost/reason logging tokens nearby.",
    });
  }

  return issues;
}

function collectB5Issues(code, path) {
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

    // B5 (architecture/security) suggestions
    DIRECT_AI_CALL: {
      category: "security",
      reason: "Remove direct AI/SDK calls — route all AI usage via the approved router/wrapper.",
    },
    PERMISSION_BYPASS_RISK: {
      category: "security",
      reason: "Add explicit permission checks for privileged handlers/commands.",
    },
    MEMORY_POLICY_RISK: {
      category: "security",
      reason: "Verify MemoryPolicy boundaries — avoid memory writes outside memory_core.",
    },
    CORE_BOUNDARY_VIOLATION: {
      category: "architecture",
      reason: "Respect module boundaries — keep transport/handlers thin and delegate responsibilities.",
    },
    OBSERVABILITY_GAP: {
      category: "observability",
      reason: "Ensure AI calls are logged with cost+reason per DECISIONS.md.",
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

      // =========================
      // B5.3 suppressions (config-only)
      // =========================
      if (it.code === "UNREACHABLE_CODE") {
        // suppress only where it is expected noise
        if (b5PathMatches(path, B5_UNREACHABLE_SUPPRESS_PATHS)) {
          continue;
        }
      }

      if (it.code === "DECISION_VIOLATION") {
        // keep it narrow: only suppress in explicitly allowed files
        if (b5PathMatches(path, B5_DECISION_SUPPRESS_PATHS)) {
          const raw = String(code || "");
          if (B5_DECISION_SUPPRESS_TOKENS.some((rx) => rx.test(raw))) {
            continue;
          }
        }
      }

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
    bySev.high > 0 || typeSet.size >= 2 ? buildSuggestionsFromAggregated(agg) : [];

  const out = [];
  out.push("repo_review: repo-level (READ-ONLY)");
  out.push(`scanned: ${filesScanned}/${batch.length} (limit=${limit})`);
  out.push(`B5: ${B5_ENABLED ? "ENABLED" : "disabled"}`);
  out.push("");

  out.push("Suggestions:");
  suggestions.length
    ? suggestions.forEach((s) => out.push(`- [${s.severity}] [${s.category}] ${s.reason}`))
    : out.push("- (none)");

  out.push("");
  out.push(`issues: high=${bySev.high}, medium=${bySev.medium}, low=${bySev.low}`);

  // Top issue buckets (helpful when B5 is enabled)
  const buckets = Object.values(agg)
    .sort((a, b) => {
      const d = severityRank(b.severity) - severityRank(a.severity);
      if (d !== 0) return d;
      return (b.count || 0) - (a.count || 0);
    })
    .slice(0, 10);

  out.push("");
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
