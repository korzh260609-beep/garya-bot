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

export async function collectDomainEvidence({
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

export default {
  repoFilesContainingAnyTokens,
  repoFilesContainingAllTokenGroups,
  buildDomainEvidenceDefs,
  collectDomainEvidence,
};
