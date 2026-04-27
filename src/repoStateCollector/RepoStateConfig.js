// src/repoStateCollector/RepoStateConfig.js
// ============================================================================
// Repo State Collector config (skeleton)
// ============================================================================

export function getRepoStateConfig() {
  return {
    enabled: false,
    maxFileSize: 200_000,
    maxFiles: 5000,
    includePatterns: ["src/"],
    excludePatterns: ["node_modules", ".git"],
  };
}

export default {
  getRepoStateConfig,
};
