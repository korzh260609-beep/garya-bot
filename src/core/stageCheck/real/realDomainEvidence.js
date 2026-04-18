// ============================================================================
// === src/core/stageCheck/real/realDomainEvidence.js
// === domain evidence collection
// ============================================================================

import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import {
  includesAny,
  isLikelyDescriptiveFile,
  isLikelyRuntimeProofFile,
  uniq,
  safeReadJson,
} from "./realEvidenceUtils.js";
import { hasSemanticOverlap } from "./realScopeProfile.js";

function normalizeScopeItems(scopeWorkflowItems = []) {
  return Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
}

function extractScopeText(scopeWorkflowItems = []) {
  return normalizeScopeItems(scopeWorkflowItems)
    .map((item) => `${item?.code || ""} ${item?.title || ""}`.trim())
    .join(" ")
    .toLowerCase();
}

function scopeIncludesAny(scopeWorkflowItems = [], tokens = []) {
  const text = extractScopeText(scopeWorkflowItems);
  return tokens.some((token) => text.includes(String(token || "").toLowerCase()));
}

function getProfileFamily(nodeProfile) {
  return String(nodeProfile?.profile?.family || "");
}

function getProfileKey(nodeProfile) {
  return String(nodeProfile?.profileKey || "");
}

export async function repoFilesContainingAnyTokens(
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

export async function repoFilesContainingAllTokenGroups(
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

    const ok = (tokenGroups || []).every((group) =>
      (group || []).some((token) => includesAny(text, [token]))
    );

    if (ok) {
      hits.push(filePath);
    }
  }

  return uniq(hits);
}

async function collectPathExistsHits(evaluationCtx, paths = []) {
  const hits = [];

  for (const path of paths) {
    if (evaluationCtx.fileSet.has(path)) {
      hits.push({
        file: path,
        matched: ["path_exists"],
      });
    }
  }

  return hits;
}

export function buildDomainEvidenceDefs() {
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
            proofRole: "implementation",
            proofClass: "runtime_surface",
          },
        ];
      },
    },
    {
      key: "database_runtime_files",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["database"],
      details: "database runtime files exist",
      collect: async ({ evaluationCtx }) => {
        return collectPathExistsHits(evaluationCtx, [
          "db.js",
          "src/db.js",
          "src/db/index.js",
          "src/db",
          "migrations",
        ]);
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "database_repo_usage",
      kind: "domain_evidence",
      strength: "strong",
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
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "database_schema_tables",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["database"],
      details: "repository contains workflow-required database tables",
      collect: async ({ evaluationCtx, scopeWorkflowItems }) => {
        const wantsCoreTables = scopeIncludesAny(scopeWorkflowItems, [
          "users",
          "chat_memory",
          "tasks",
          "sources",
          "logs",
          "project_memory",
          "postgresql",
          "database",
          "tables",
        ]);

        if (!wantsCoreTables) return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "create table users",
            "create table chat_memory",
            "create table tasks",
            "create table sources",
            "create table logs",
            "create table project_memory",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["database_table_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "database_migrations_framework",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["database"],
      details: "repository contains migration framework / schema version signals",
      collect: async ({ evaluationCtx, scopeWorkflowItems }) => {
        const wantsMigrations = scopeIncludesAny(scopeWorkflowItems, [
          "migration",
          "migrations",
          "schema_version",
          "forward-only",
        ]);

        if (!wantsMigrations) return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "node-pg-migrate",
            "knex",
            "schema_version",
            "forward-only",
            "migration",
            "migrations",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["migration_framework_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "tasks_runner_surface",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["tasks"],
      details: "repository contains task runner / jobs signals",
      collect: async ({ evaluationCtx }) => {
        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "JobRunner",
            "jobRunner",
            "enqueue(",
            "retry",
            "dlq",
            "cron",
            "/tasks",
            "/run",
            "/newtask",
          ],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["tasks_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "tasks_runtime_files",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["tasks"],
      details: "task runtime files exist",
      collect: async ({ evaluationCtx }) => {
        return collectPathExistsHits(evaluationCtx, [
          "src/jobs/jobRunnerInstance.js",
          "src/jobs",
          "src/tasks",
        ]);
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "tasks_execution_safety",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["tasks"],
      details: "repository contains idempotency / retry / dlq / lock signals",
      collect: async ({ evaluationCtx, scopeWorkflowItems }) => {
        const wantsExecutionSafety = scopeIncludesAny(scopeWorkflowItems, [
          "idempotency",
          "retry",
          "dlq",
          "lock",
          "advisory",
          "exactly one run",
          "restart dedupe",
        ]);

        if (!wantsExecutionSafety) return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "idempotency",
            "idempotency_key",
            "task_run_key",
            "retry",
            "max_retries",
            "dlq",
            "advisory lock",
            "lock",
            "exactly one run",
            "restart dedupe",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["tasks_execution_safety_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "feature_memory_signals",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["memory"],
      details: "repository contains memory implementation signals",
      collect: async ({ evaluationCtx, nodeProfile }) => {
        if (getProfileKey(nodeProfile) !== "feature.memory") return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "MemoryService",
            "chat_memory",
            "context selection",
            "recent(",
            "write(",
            "read(",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["memory_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "feature_sources_signals",
      kind: "domain_evidence",
      strength: "strong",
      tags: ["sources"],
      details: "repository contains sources-layer implementation signals",
      collect: async ({ evaluationCtx, nodeProfile }) => {
        if (getProfileFamily(nodeProfile) !== "feature") return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "source",
            "ensureDefaultSources",
            "fetchFromSourceKey",
            "source_checks",
            "diag_source",
            "coingecko",
            "rss",
            "html",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["sources_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
    },
    {
      key: "integration_external_signals",
      kind: "domain_evidence",
      strength: "medium",
      tags: ["transport", "sources"],
      details: "repository contains external integration implementation signals",
      collect: async ({ evaluationCtx, nodeProfile }) => {
        if (getProfileFamily(nodeProfile) !== "integration") return [];

        const files = await repoFilesContainingAnyTokens(
          evaluationCtx,
          [
            "discord",
            "github",
            "zoom",
            "voice",
            "adapter",
            "integration",
            "api",
          ],
          10
        );

        return files.map((file) => ({
          file,
          matched: ["integration_signal"],
          proofRole: "implementation",
          proofClass: "runtime_surface",
        }));
      },
      proofRole: "implementation",
      proofClass: "runtime_surface",
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
          proofRole: "context",
          proofClass: "runtime_surface",
        }));
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
          ],
          8
        );

        return files.map((file) => ({
          file,
          matched: ["identity_signal"],
          proofRole: "context",
          proofClass: "runtime_surface",
        }));
      },
    },
  ];
}

export async function collectDomainEvidence({
  evaluationCtx,
  scopeSemanticProfile,
  scopeWorkflowItems,
  nodeProfile,
}) {
  const defs = buildDomainEvidenceDefs();
  const scopeTags = scopeSemanticProfile?.tags || [];
  const passed = [];

  for (const def of defs) {
    if (!hasSemanticOverlap(def.tags, scopeTags)) continue;

    try {
      const hits = await def.collect({
        evaluationCtx,
        scopeSemanticProfile,
        scopeWorkflowItems: normalizeScopeItems(scopeWorkflowItems),
        nodeProfile,
      });

      if (!Array.isArray(hits) || hits.length === 0) continue;

      for (const hit of hits.slice(0, 8)) {
        const file = String(hit?.file || "").trim();
        if (!file) continue;

        const proofClass =
          hit?.proofClass ||
          (isLikelyDescriptiveFile(file) ? "descriptive" : "runtime_surface");

        passed.push({
          side: "real",
          kind: def.kind,
          subkind: def.key,
          file,
          strength: hit?.strength || def.strength,
          tags: def.tags,
          matched: Array.isArray(hit?.matched) ? hit.matched : [],
          proofRole: hit?.proofRole || def.proofRole || "context",
          proofClass,
          details: def.details,
        });
      }
    } catch (_) {}
  }

  return passed;
}

export default {
  repoFilesContainingAnyTokens,
  repoFilesContainingAllTokenGroups,
  buildDomainEvidenceDefs,
  collectDomainEvidence,
};