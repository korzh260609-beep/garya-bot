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

    // 1) Pillars first (canonical)
    for (const path of PILLARS) {
      const item = await this.source.fetchTextFile(path);
      if (item && typeof item.content === "string") {
        snapshot.addFile({ path, content: item.content });
        fetched += 1;
      } else {
        skipped += 1;
      }
    }

    // 2) Then normal files (limited)
    const files = await this.source.listFiles();

    // keep list tight: only allow selected prefixes (includes "src/")
    const filtered = Array.isArray(files)
      ? files.filter(
          (p) =>
            typeof p === "string" &&
            ALLOWED_PREFIXES.some((pref) => p.startsWith(pref)) &&
            !p.startsWith("pillars/") // avoid duplicates (pillars already fetched above)
        )
      : [];

    const MAX_FILES_PER_RUN = 20;
    const batch = filtered.slice(0, MAX_FILES_PER_RUN);

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
      filesListed: Array.isArray(files) ? files.length : 0,
      filesFetched: fetched,
      filesSkipped: skipped,
    });

    // 3) Optional: persist normalized snapshot (structure+hashes only) into PostgreSQL
    // NOTE: commit/blob sha are not available in current flow; can be added later from GitHub tree API.
    let persisted = null;
    if (this.store && typeof this.store.saveSnapshot === "function") {
      const normalizedFiles = (snapshot.files || []).map((f) => ({
        path: f.path,
        size: Number(f.size) || 0,
        blobSha: null, // TODO: fill from GitHub tree item sha later
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
