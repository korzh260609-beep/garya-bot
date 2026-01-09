// ============================================================================
// === src/repo/RepoIndexService.js — SKELETON
// ============================================================================

export class RepoIndexService {
  constructor({ repo, branch, token }) {
    this.repo = repo;
    this.branch = branch;
    this.token = token;
  }

  async runIndex() {
    // SKELETON: здесь будет логика индексации репозитория
    return {
      status: "stub",
      filesIndexed: 0,
    };
  }
}

