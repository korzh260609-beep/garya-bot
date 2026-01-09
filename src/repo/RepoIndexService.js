// ============================================================================
// === src/repo/RepoIndexService.js — SKELETON (with RepoSource)
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
    // SKELETON: только проверка связки
    const files = await this.source.listFiles();

    return {
      status: "stub",
      filesIndexed: Array.isArray(files) ? files.length : 0,
    };
  }
}
