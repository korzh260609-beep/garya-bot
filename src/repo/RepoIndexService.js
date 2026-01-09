// ============================================================================
// === src/repo/RepoIndexService.js — DRY-RUN with Snapshot + Pillars (priority)
// ============================================================================

import { RepoSource } from "./RepoSource.js";
import { RepoIndexSnapshot } from "./RepoIndexSnapshot.js";

const PILLARS = [
  "pillars/DECISIONS.md",
  "pillars/KINGDOM.md",
  "pillars/PROJECT.md",
  "pillars/ROADMAP.md",
  "pillars/SG_BEHAVIOR.md",
  "pillars/WORKFLOW.md",
];

export class RepoIndexService {
  constructor({ repo, branch, token }) {
    this.repo = repo;
    this.branch = branch;
    this.token = token;

    this.source = new RepoSource({ repo, branch, token });
  }

  async runIndex() {
    const snapshot = new RepoIndexSnapshot({
      repo: this.repo,
      branch: this.branch,
    });

    let fetched = 0;
    let skipped = 0;

    // 1) СНАЧАЛА читаем PILLARS (приоритет)
    for (const path of PILLARS) {
      const item = await this.source.fetchTextFile(path);
      if (item && item.content) {
        snapshot.addFile({ path, content: item.content });
        fetched += 1;
      } else {
        skipped += 1;
      }
    }

    // 2) Потом обычные файлы (ограниченно)
    const files = await this.source.listFiles();
    const MAX_FILES_PER_RUN = 20;
    const batch = Array.isArray(files) ? files.slice(0, MAX_FILES_PER_RUN) : [];

    for (const path of batch) {
      // не дублируем pillars
      if (path.startsWith("pillars/")) continue;

      const item = await this.source.fetchTextFile(path);
      if (item && item.content) {
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

    return snapshot;
  }
}
