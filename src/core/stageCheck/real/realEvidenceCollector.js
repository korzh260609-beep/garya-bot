// ============================================================================
// === src/core/stageCheck/real/realEvidenceCollector.js
// === universal real-evidence collector
// === repo wiring / connectedness / runtime foundation / domain evidence
// ============================================================================

import {
  collectOwnSignals,
  buildAutoChecksForItem,
} from "../../../bot/handlers/stage-check/signals.js";
import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import { buildRealConnectedness } from "./realConnectedness.js";

function uniq(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+/, "")
    .replace(/['"]+$/, "");
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function includesAny(text, tokens = []) {
  const hay = lower(text);
  return (tokens || []).some((x) => hay.includes(lower(x)));
}

function includesAll(text, tokens = []) {
  const hay = lower(text);
  return (tokens || []).every((x) => hay.includes(lower(x)));
}

function parseNodeScriptEntrypoints(scriptText) {
  const text = String(scriptText || "");
  const matches = [];
  const regex = /node\s+(\.\/)?([A-Za-z0-9_./-]+\.(?:js|mjs|cjs|ts|mts|cts))/g;

  let m = null;
  while ((m = regex.exec(text))) {
    matches.push(stripQuotes(m[2] || ""));
  }

  return uniq(matches);
}

function getExtension(path) {
  const value = String(path || "").trim().toLowerCase();
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index) : "";
}

function isLikelyDescriptiveFile(path) {
  const filePath = String(path || "").trim().toLowerCase();
  const ext = getExtension(filePath);

  if (filePath.startsWith("pillars/")) return true;
  if (filePath.includes("/docs/")) return true;
  if (filePath.includes("/doc/")) return true;

  return (
    ext === ".md" ||
    ext === ".txt" ||
    ext === ".yaml" ||
    ext === ".yml"
  );
}

function isLikelyRuntimeProofFile(path) {
  const ext = getExtension(path);
  return (
    ext === ".js" ||
    ext === ".mjs" ||
    ext === ".cjs" ||
    ext === ".ts" ||
    ext === ".mts" ||
    ext === ".cts" ||
    ext === ".sql" ||
    ext === ".json"
  );
}

async function safeReadJson(path, evaluationCtx) {
  try {
    const text = await safeFetchTextFile(path, evaluationCtx);
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function discoverEntrypoints(evaluationCtx) {
  const entrypoints = [];

  if (evaluationCtx.fileSet.has("package.json")) {
    try {
      const pkgText = await safeFetchTextFile("package.json", evaluationCtx);
      if (pkgText) {
        const pkg = JSON.parse(pkgText);

        if (pkg?.main) {
          entrypoints.push(stripQuotes(pkg.main));
        }

        const scripts = pkg?.scripts || {};
        for (const value of Object.values(scripts)) {
          entrypoints.push(...parseNodeScriptEntrypoints(value));
        }
      }
    } catch (_) {}
  }

  for (const fallback of ["index.js", "src/index.js", "server.js", "app.js"]) {
    if (evaluationCtx.fileSet.has(fallback)) {
      entrypoints.push(fallback);
    }
  }

  return uniq(entrypoints).filter((x) => evaluationCtx.fileSet.has(x));
}

function findBasenameInRepo(basename, fileSet) {
  const needle = String(basename || "").trim().toLowerCase();
  if (!needle) return "";

  for (const path of fileSet) {
    const parts = String(path || "").split("/");
    const last = String(parts[parts.length - 1] || "").toLowerCase();
    if (last === needle) return path;
  }

  return "";
}

function collectCandidateFilesFromScope(scopeWorkflowItems, evaluationCtx) {
  const candidates = [];

  for (const item of scopeWorkflowItems) {
    const own = collectOwnSignals(item, evaluationCtx.config);

    for (const explicitPath of own.explicitPaths || []) {
      if (evaluationCtx.fileSet.has(explicitPath)) {
        candidates.push(explicitPath);
      }
    }

    const autoChecks = buildAutoChecksForItem(
      item,
      evaluationCtx.itemMap,
      evaluationCtx.config
    );

    for (const check of autoChecks) {
      if (check?.type === "file_exists" && evaluationCtx.fileSet.has(check.path)) {
        candidates.push(check.path);
      }

      if (check?.type === "basename_exists") {
        const found = findBasenameInRepo(check.basename, evaluationCtx.fileSet);
        if (found) candidates.push(found);
      }
    }
  }

  return uniq(candidates);
}

function fileMayReferenceCandidate(content, candidatePath) {
  const text = String(content || "");
  const candidate = String(candidatePath || "").trim();
  if (!text || !candidate) return false;

  const filename = candidate.split("/").pop() || candidate;
  const basename = filename.replace(/\.[^.]+$/, "");

  return (
    text.includes(candidate) ||
    text.includes(filename) ||
    text.includes(`./${basename}`) ||
    text.includes(`../${basename}`) ||
    text.includes(`"${basename}"`) ||
    text.includes(`'${basename}'`) ||
    text.includes(`"${filename}"`) ||
    text.includes(`'${filename}'`)
  );
}

async function findDirectEntrypointMatches({
  entrypoints,
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];

  for (const entrypoint of entrypoints) {
    const content = await safeFetchTextFile(entrypoint, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles) {
      if (entrypoint === candidate) {
        matches.push({ entrypoint, candidate });
        continue;
      }

      if (fileMayReferenceCandidate(content, candidate)) {
        matches.push({ entrypoint, candidate });
      }
    }
  }

  return matches;
}

async function findRepoReferenceMatches({
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];
  const searchable = Array.isArray(evaluationCtx.searchableFiles)
    ? evaluationCtx.searchableFiles.slice(0, 220)
    : [];

  for (const filePath of searchable) {
    if (isLikelyDescriptiveFile(filePath)) continue;

    const content = await safeFetchTextFile(filePath, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles) {
      if (filePath === candidate) continue;
      if (fileMayReferenceCandidate(content, candidate)) {
        matches.push({ file: filePath, candidate });
      }
    }
  }

  return matches;
}

function addTagsFromPatterns(tags, text, patterns, tag) {
  if (patterns.some((x) => text.includes(x))) {
    tags.add(tag);
  }
}

function buildScopeSemanticProfile(scopeWorkflowItems) {
  const text = (scopeWorkflowItems || [])
    .map((item) => `${item?.title || ""}\n${item?.body || ""}`)
    .join("\n")
    .toLowerCase();

  const tags = new Set();

  addTagsFromPatterns(
    tags,
    text,
    [
      "base infrastructure",
      "node.js",
      "express",
      "webhook",
      "render",
      "runtime",
      "bootstrap",
      "entrypoint",
      "server",
      "http",
      "transport adapter concept",
      "unified context",
      "handlemessage",
    ],
    "runtime"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["telegram", "webhook", "process update", "adapter", "transport", "delivery"],
    "transport"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["postgresql", "database", "db", "migrations", "schema", "table", "storage"],
    "database"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["task", "tasks", "queue", "worker", "jobrunner", "cron", "retry", "dlq"],
    "tasks"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["access", "roles", "permissions", "guest", "monarch", "citizen", "can("],
    "access"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["identity", "global_user_id", "user_links", "linking flow", "platform_user_id", "multi-channel"],
    "identity"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["observability", "/health", "error_events", "logs", "metrics", "alerts", "diagnostics"],
    "observability"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["memory", "chat_memory", "context", "recent", "long-term", "recall"],
    "memory"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["sources", "rss", "html", "coingecko", "source cache", "fetch", "api"],
    "sources"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["file-intake", "ocr", "pdf", "docx", "audio transcript", "vision", "file"],
    "file_intake"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["capability", "diagram", "document generation", "code/repo analysis", "automation/webhook"],
    "capability"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["billing", "legal", "tariffs", "plans", "ai-credits", "privacy", "license"],
    "billing"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["risk", "market", "btc", "alerts", "rotation", "reenter", "exit_now"],
    "risk"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["psych", "mood", "technique", "safe_policies", "therapy", "diagnosis"],
    "psycho"
  );

  if (tags.size === 0) {
    tags.add("generic");
  }

  return {
    tags: Array.from(tags),
    rawText: text,
  };
}

function hasSemanticOverlap(defTags, scopeTags) {
  const left = Array.isArray(defTags) ? defTags : [];
  const right = new Set(Array.isArray(scopeTags) ? scopeTags : []);
  return left.some((tag) => right.has(tag));
}

function buildRuntimeFoundationDefs() {
  return [
    {
      key: "package_main",
      file: "package.json",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        return !!String(pkg?.main || "").trim();
      },
      details: "package.json has main entrypoint",
    },
    {
      key: "package_start_script",
      file: "package.json",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        const startScript = String(pkg?.scripts?.start || "").trim();
        return !!startScript && startScript.includes("node");
      },
      details: "package.json has node start script",
    },
    {
      key: "index_exists",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        return evaluationCtx.fileSet.has("index.js");
      },
      details: "root runtime entry file exists",
    },
    {
      key: "express_bootstrap",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("express") &&
          (text.includes("createApp(") || text.includes("express("))
        );
      },
      details: "entrypoint bootstraps express/http app",
    },
    {
      key: "telegram_transport_bootstrap",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("initTelegramTransport") &&
          text.includes("telegramTransport")
        );
      },
      details: "entrypoint wires telegram transport bootstrap",
    },
    {
      key: "telegram_adapter_wiring",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return text.includes("TelegramAdapter") && text.includes(".attach(");
      },
      details: "entrypoint wires transport adapter attach",
    },
    {
      key: "core_deps_wiring",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("buildCoreDeps") &&
          text.includes("telegramAdapter.deps")
        );
      },
      details: "entrypoint wires core deps into adapter",
    },
    {
      key: "webhook_setup",
      file: "src/bot/telegramTransport.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/telegramTransport.js",
          evaluationCtx
        );
        if (!text) return false;
        return text.includes("setWebHook") || text.includes("setWebhook");
      },
      details: "telegram transport sets webhook",
    },
    {
      key: "process_update",
      file: "src/bot/telegramTransport.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/telegramTransport.js",
          evaluationCtx
        );
        if (!text) return false;
        return text.includes("processUpdate");
      },
      details: "telegram transport processes updates",
    },
  ];
}

async function collectRuntimeFoundationEvidence({
  evaluationCtx,
  scopeSemanticProfile,
}) {
  const defs = buildRuntimeFoundationDefs();
  const scopeTags = scopeSemanticProfile?.tags || [];
  const passed = [];

  for (const def of defs) {
    if (!hasSemanticOverlap(def.tags, scopeTags)) continue;

    try {
      const ok = await def.test({ evaluationCtx });
      if (!ok) continue;

      passed.push({
        side: "real",
        kind: def.kind,
        subkind: def.key,
        file: def.file,
        strength: def.strength,
        tags: def.tags,
        proofRole: "implementation",
        details: def.details,
      });
    } catch (_) {}
  }

  return passed;
}

async function repoFilesContainingAnyTokens(
  evaluationCtx,
  tokens = [],
  limit = 12,
  options = {}
) {
  const hits = [];
  const includeDescriptive = !!options.includeDescriptive;
  const searchable = Array.isArray(evaluationCtx.searchableFiles)
    ? evaluationCtx.searchableFiles.slice(0, 240)
    : [];

  for (const filePath of searchable) {
    if (hits.length >= limit) break;
    if (!includeDescriptive && !isLikelyRuntimeProofFile(filePath)) continue;

    const text = await safeFetchTextFile(filePath, evaluationCtx);
    if (!text) continue;
    if (includesAny(text, tokens)) {
      hits.push(filePath);
    }
  }

  return uniq(hits);
}

async function repoFilesContainingAllTokenGroups(
  evaluationCtx,
  tokenGroups = [],
  limit = 12,
  options = {}
) {
  const hits = [];
  const includeDescriptive = !!options.includeDescriptive;
  const searchable = Array.isArray(evaluationCtx.searchableFiles)
    ? evaluationCtx.searchableFiles.slice(0, 240)
    : [];

  for (const filePath of searchable) {
    if (hits.length >= limit) break;
    if (!includeDescriptive && !isLikelyRuntimeProofFile(filePath)) continue;

    const text = await safeFetchTextFile(filePath, evaluationCtx);
    if (!text) continue;

    const ok = (tokenGroups || []).every((group) => includesAny(text, group));
    if (ok) {
      hits.push(filePath);
    }
  }

  return uniq(hits);
}

function buildDomainEvidenceDefs() {
  return [
    {
      key: "database_pg_dependency",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["database"],
      details: "postgres driver dependency exists",
      collect: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        const deps = {
          ...(pkg?.dependencies || {}),
          ...(pkg?.devDependencies || {}),
        };

        if (!deps.pg && !deps["node-pg-migrate"]) return [];
        return [
          {
            file: "package.json",
            matched: deps.pg ? ["pg"] : ["node-pg-migrate"],
          },
        ];
      },
    },
    {
      key: "database_runtime_files",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["database"],
      details: "database runtime files exist",
      collect: async ({ evaluationCtx }) => {
        const candidates = [
          "db.js",
          "src/db.js",
          "src/db/index.js",
          "migrations",
        ];

        const hits = [];
        for (const path of candidates) {
          if (evaluationCtx.fileSet.has(path)) {
            hits.push({ file: path, matched: ["path_exists"] });
          }
        }

        return hits;
      },
    },
    {
      key: "database_repo_usage",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["database"],
      details: "repository contains database usage signals",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          ["pool.query(", "new Pool(", 'from "pg"', "node-pg-migrate", "migrations"],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["database_usage_signal"],
        }));
      },
    },
    {
      key: "tasks_runner_surface",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["tasks"],
      details: "repository contains task runner / jobs signals",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          ["JobRunner", "jobRunner", "enqueue(", "retry", "dlq", "cron", "/tasks", "/run", "/newtask"],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["tasks_signal"],
        }));
      },
    },
    {
      key: "tasks_runtime_files",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["tasks"],
      details: "task runtime files exist",
      collect: async ({ evaluationCtx }) => {
        const hits = [];
        for (const path of [
          "src/jobs/jobRunnerInstance.js",
          "src/jobs",
          "src/tasks",
        ]) {
          if (evaluationCtx.fileSet.has(path)) {
            hits.push({ file: path, matched: ["path_exists"] });
          }
        }
        return hits;
      },
    },
    {
      key: "access_guard_usage",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["access"],
      details: "repository contains access/permission guards",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "requireMonarchPrivateAccess",
            "permission",
            "permissions",
            "can(",
            "role",
            "roles",
            "guest",
            "monarch",
          ],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["access_signal"],
        }));
      },
    },
    {
      key: "access_guard_files",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["access"],
      details: "access-related files exist",
      collect: async ({ evaluationCtx }) => {
        const hits = [];
        for (const path of [
          "src/bot/handlers/handlerAccess.js",
          "src/users/userAccess.js",
          "src/access",
        ]) {
          if (evaluationCtx.fileSet.has(path)) {
            hits.push({ file: path, matched: ["path_exists"] });
          }
        }
        return hits;
      },
    },
    {
      key: "identity_repo_usage",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["identity"],
      details: "repository contains identity/linking signals",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "global_user_id",
            "platform_user_id",
            "user_links",
            "user_identities",
            "linking flow",
            "link code",
            "confirm link",
          ],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["identity_signal"],
        }));
      },
    },
    {
      key: "identity_strong_pair",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["identity"],
      details: "repository contains linked identity model signals",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAllTokenGroups(
          evaluationCtx,
          [
            ["global_user_id", "platform_user_id"],
            ["user_links", "user_identities", "linking"],
          ],
          6
        );

        return files.map((file) => ({
          file,
          matched: ["identity_pair_signal"],
        }));
      },
    },
  ];
}

async function collectDomainEvidence({
  evaluationCtx,
  scopeSemanticProfile,
}) {
  const defs = buildDomainEvidenceDefs();
  const scopeTags = scopeSemanticProfile?.tags || [];
  const passed = [];

  for (const def of defs) {
    if (!hasSemanticOverlap(def.tags, scopeTags)) continue;

    try {
      const hits = await def.collect({ evaluationCtx });
      if (!Array.isArray(hits) || hits.length === 0) continue;

      for (const hit of hits.slice(0, 8)) {
        const file = String(hit?.file || "").trim();
        if (!file) continue;

        const descriptive = isLikelyDescriptiveFile(file);

        passed.push({
          side: "real",
          kind: def.kind,
          subkind: def.key,
          file,
          strength: def.strength,
          tags: def.tags,
          matched: Array.isArray(hit?.matched) ? hit.matched : [],
          proofRole: "context",
          proofClass: descriptive ? "descriptive" : "runtime_surface",
          details: def.details,
        });
      }
    } catch (_) {}
  }

  return passed;
}

function buildScopeStats(scopeWorkflowItems) {
  const items = Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
  const exactItems = items.filter(
    (item) => String(item?.kind || "").toLowerCase() === "item"
  ).length;
  const stageItems = items.filter(
    (item) =>
      String(item?.kind || "").toLowerCase() === "stage" ||
      String(item?.kind || "").toLowerCase() === "substage"
  ).length;

  return {
    scopeItemCount: items.length,
    exactItems,
    stageItems,
    isLargeScope: items.length >= 8,
    isVeryLargeScope: items.length >= 14,
  };
}

function buildRealEvidence({
  candidateFiles,
  connectedness,
  runtimeFoundationEvidence,
  domainEvidence,
}) {
  const evidence = [];

  for (const path of candidateFiles.slice(0, 12)) {
    evidence.push({
      side: "real",
      kind: "candidate_file",
      file: path,
      proofRole: "implementation",
      details: "candidate_file_exists_in_repo",
    });
  }

  const directMatches = Array.isArray(connectedness?.directEntrypointMatches)
    ? connectedness.directEntrypointMatches
    : [];

  if (directMatches.length > 0) {
    for (const match of directMatches.slice(0, 8)) {
      evidence.push({
        side: "real",
        kind: "entrypoint_wiring",
        file: match.candidate,
        entrypoint: match.entrypoint,
        proofRole: "implementation",
        details: "candidate_referenced_from_entrypoint",
      });
    }
  }

  for (const match of (connectedness?.repoReferenceMatches || []).slice(0, 8)) {
    evidence.push({
      side: "real",
      kind: "repo_reference",
      file: match.file,
      candidate: match.candidate,
      proofRole: "implementation",
      details: "candidate_referenced_elsewhere_in_repo",
    });
  }

  for (const item of (runtimeFoundationEvidence || []).slice(0, 12)) {
    evidence.push(item);
  }

  for (const item of (domainEvidence || []).slice(0, 12)) {
    evidence.push(item);
  }

  return evidence;
}

export async function collectRealEvidence({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const scopeSemanticProfile = buildScopeSemanticProfile(scopeWorkflowItems);
  const scopeStats = buildScopeStats(scopeWorkflowItems);

  const entrypoints = await discoverEntrypoints(evaluationCtx);
  const candidateFiles = collectCandidateFilesFromScope(
    scopeWorkflowItems,
    evaluationCtx
  );

  const directEntrypointMatches = await findDirectEntrypointMatches({
    entrypoints,
    candidateFiles,
    evaluationCtx,
  });

  const repoReferenceMatches = await findRepoReferenceMatches({
    candidateFiles,
    evaluationCtx,
  });

  const connectedness = buildRealConnectedness({
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
  });

  const runtimeFoundationEvidence = await collectRuntimeFoundationEvidence({
    evaluationCtx,
    scopeSemanticProfile,
  });

  const domainEvidence = await collectDomainEvidence({
    evaluationCtx,
    scopeSemanticProfile,
  });

  const evidence = buildRealEvidence({
    candidateFiles,
    connectedness,
    runtimeFoundationEvidence,
    domainEvidence,
  });

  return {
    scopeSemanticProfile,
    scopeStats,
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
    connectedness,
    runtimeFoundationEvidence,
    domainEvidence,
    evidence,
  };
}

export default {
  collectRealEvidence,
};
