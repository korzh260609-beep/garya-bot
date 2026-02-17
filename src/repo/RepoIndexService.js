// ============================================================================
// === src/repo/RepoIndexService.js — DRY-RUN + (optional) Postgres snapshot persist
// ============================================================================

import { RepoSource } from "./RepoSource.js";
import { RepoIndexSnapshot } from "./RepoIndexSnapshot.js";

/**
 * Pillars are canonical sources for SG behavior and workflow.
 * Keep this list aligned with actual pillars/ folder content.
 */
const PILLARS = [
  "pillars/CODE_INSERT_RULES.md",
  "pillars/DECISIONS.md",
  "pillars/KINGDOM.md",
  "pillars/PROJECT.md",
  "pillars/REPOINDEX.md",
  "pillars/ROADMAP.md",
  "pillars/SG_BEHAVIOR.md",
  "pillars/SG_ENTITY.md",
  "pillars/WORKFLOW.md",
];

// ✅ Allowed prefixes for snapshot indexing (keep tight to avoid huge scans)
const ALLOWED_PREFIXES = ["src/", "core/", "diagnostics/", "pillars/"];

// ✅ REQUIRED_FILES: MUST be in snapshot regardless of prefix filter / ordering.
// NOTE: these are paths as they appear in /repo_tree output (root files have no "src/").
const REQUIRED_FILES = [
  "db.js",
  "index.js",
  "modelConfig.js",

  "src/bot/messageRouter.js",

  "src/bot/handlers/reindexRepo.js",
  "src/bot/handlers/repoStatus.js",
  "src/bot/handlers/repoTree.js",
  "src/bot/handlers/repoFile.js",
  "src/bot/handlers/repoAnalyze.js",
  "src/bot/handlers/repoSearch.js",
];

// ✅ Priority prefixes AFTER REQUIRED_FILES
const PRIORITY_PREFIXES = ["src/repo/", "src/bot/", "core/", "diagnostics/"];

function sortByPriority(paths) {
  const buckets = PRIORITY_PREFIXES.map(() => []);
  const rest = [];

  for (const p of paths) {
    let placed = false;
    for (let i = 0; i < PRIORITY_PREFIXES.length; i += 1) {
      if (p.startsWith(PRIORITY_PREFIXES[i])) {
        buckets[i].push(p);
        placed = true;
        break;
      }
    }
    if (!placed) rest.push(p);
  }

  // deterministic order inside groups
  for (const b of buckets) b.sort((a, c) => a.localeCompare(c));
  rest.sort((a, c) => a.localeCompare(c));

  return buckets.flat().concat(rest);
}

export class RepoIndexService {
  /**
   * @param {object} params
   * @param {string} params.repo
   * @param {string} params.branch
   * @param {string} params.token
   * @param {object} [params.store] optional RepoIndexStore (PostgreSQL persistence)
   */
  constructor({ repo, branch, token, store = null }) {
    this.repo = repo;
    this.branch = branch;
    this.token = token;

    this.source = new RepoSource({ repo, branch, token });
    this.store = store; // optional
  }

  /**
   * Build in-memory snapshot (preview) and optionally persist normalized index to PostgreSQL.
   * IMPORTANT:
   * - RepoIndexSnapshot contains content (for preview/memory-policy decisions)
   * - PostgreSQL snapshot MUST store only structure+hashes (no content)
   */
  async runIndex() {
    const snapshot = new RepoIndexSnapshot({
      repo: this.repo,
      branch: this.branch,
    });

    let fetched = 0;
    let skipped = 0;

    // 1) Pillars first (canonical) — content
    for (const path of PILLARS) {
      const item = await this.source.fetchTextFile(path);
      if (item && typeof item.content === "string") {
        snapshot.addFile({ path, content: item.content });
        fetched += 1;
      } else {
        skipped += 1;
      }
    }

    // 2) Full Tree paths-only (NO CONTENT) — Contour A
    // RepoSource.listFiles() already uses GitHub Tree API (recursive=1)
    const allTreePaths = await this.source.listFiles();
    const filesListed = Array.isArray(allTreePaths) ? allTreePaths.length : 0;

    const fileSet = new Set(Array.isArray(allTreePaths) ? allTreePaths : []);

    // 2.1 REQUIRED_FILES first (if they exist in repo)
    const requiredExisting = REQUIRED_FILES.filter((p) => fileSet.has(p));

    // 2.2 Content candidates via allowed prefixes (Contour B: allowlist content index)
    const filtered = Array.isArray(allTreePaths)
      ? allTreePaths.filter(
          (p) =>
            typeof p === "string" &&
            ALLOWED_PREFIXES.some((pref) => p.startsWith(pref)) &&
            !p.startsWith("pillars/") // avoid duplicates (pillars already fetched above)
        )
      : [];

    // Remove required from filtered to avoid duplicates, then sort by priority
    const filteredWithoutRequired = filtered.filter((p) => !requiredExisting.includes(p));
    const ordered = requiredExisting.concat(sortByPriority(filteredWithoutRequired));

    const MAX_FILES_PER_RUN = Math.max(
      20,
      Number(process.env.REPOINDEX_MAX_FILES || 200)
    );

    const batch = ordered.slice(0, MAX_FILES_PER_RUN);

    // 2.3 Fetch content only for allowlisted batch (Contour B)
    for (const path of batch) {
      const item = await this.source.fetchTextFile(path);
      if (item && typeof item.content === "string") {
        snapshot.addFile({ path, content: item.content });
        fetched += 1;
      } else {
        skipped += 1;
      }
    }

    snapshot.finalize({
      filesListed,
      filesFetched: fetched,
      filesSkipped: skipped,
      // extra hint for debugging/visibility (stored inside snapshot.stats)
      fullTreeFilesListed: filesListed,
      contentCandidatesTotal: ordered.length,
      contentBatchSize: batch.length,
    });

    // 3) Optional: persist normalized snapshot (structure+hashes only) into PostgreSQL
    // IMPORTANT CHANGE:
    // - Persist FULL TREE paths (Contour A) instead of snapshot.files (which is allowlist content).
    // - Still NO CONTENT stored.
    let persisted = null;
    if (this.store && typeof this.store.saveSnapshot === "function") {
      const normalizedFiles = (Array.isArray(allTreePaths) ? allTreePaths : []).map((p) => ({
        path: p,
        size: 0,     // not available in current flow
        blobSha: null, // TODO: fill later (GitHub tree item sha)
      }));

      const snapshotId = await this.store.saveSnapshot({
        repo: this.repo,
        branch: this.branch,
        commitSha: null, // TODO: fill later (tree/commit ref)
        stats: snapshot.stats,
        files: normalizedFiles,
      });

      persisted = {
        snapshotId,
        filesCount: normalizedFiles.length,
      };
    }

    // Keep backward compatibility: return snapshot, and additional persisted metadata if any
    return { snapshot, persisted };
  }
}
