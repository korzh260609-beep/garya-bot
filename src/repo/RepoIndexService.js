// ============================================================================
// === src/repo/RepoIndexService.js — DRY-RUN (fetch content, no DB)
// ============================================================================

import { RepoSource } from "./RepoSource.js";

export class RepoIndexService {
  constructor({ repo, branch, token }) {
    this.repo = repo;
    this.branch = branch;
    this.token = token;

    this.source = new RepoSource({
      repo,
      branch,
      token,
    });
  }

  async runIndex() {
    const files = await this.source.listFiles();

    // SAFETY CAP: чтобы не упереться в таймауты Render
    const MAX_FILES_PER_RUN = 20;
    const batch = Array.isArray(files) ? files.slice(0, MAX_FILES_PER_RUN) : [];

    let fetched = 0;
    let skipped = 0;

    for (const path of batch) {
      const item = await this.source.fetchTextFile(path);
      if (item && typeof item.content === "string") fetched += 1;
      else skipped += 1;
    }

    return {
      status: "dry-run",
      filesListed: Array.isArray(files) ? files.length : 0,
      filesFetched: fetched,
      filesSkipped: skipped,
    };
  }
}
