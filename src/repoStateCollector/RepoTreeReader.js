// src/repoStateCollector/RepoTreeReader.js
// ============================================================================
// Repo Tree Reader (skeleton)
// Reads repository structure (read-only).
// ============================================================================

export class RepoTreeReader {
  constructor({ githubClient, config } = {}) {
    this.githubClient = githubClient;
    this.config = config;
  }

  async readTree() {
    // TODO: implement in next step
    return {
      ok: true,
      files: [],
    };
  }
}

export default RepoTreeReader;
