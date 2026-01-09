// ============================================================================
// === src/repo/RepoSource.js — GitHub Repo Source (SKELETON)
// ============================================================================

export class RepoSource {
  constructor({ repo, branch, token }) {
    this.repo = repo;     // "owner/name"
    this.branch = branch; // "main"
    this.token = token;   // fine-grained PAT
  }

  async listFiles() {
    // SKELETON: будет GitHub API list tree
    return [];
  }

  async fetchTextFile(path) {
    // SKELETON: будет GitHub API get content / blob
    return null;
  }
}

