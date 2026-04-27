// src/repoStateCollector/RepoStateConfig.js
// ============================================================================
// Repo State Collector config
// ============================================================================

import { envStr } from "../core/config.js";

function envBool(name, fallback = false) {
  const raw = envStr(name, fallback ? "true" : "false").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback) {
  const raw = Number(envStr(name, String(fallback)).trim());
  return Number.isFinite(raw) ? raw : fallback;
}

export function getRepoStateConfig() {
  const githubToken = envStr("REPO_STATE_GITHUB_TOKEN", envStr("GITHUB_TOKEN", "")).trim();

  return {
    enabled: envBool("REPO_STATE_COLLECTOR_ENABLED", false),
    repoFullName: envStr("REPO_STATE_REPO_FULL_NAME", "korzh260609-beep/garya-bot").trim(),
    branch: envStr("REPO_STATE_BRANCH", "main").trim(),
    githubToken,
    githubApiBaseUrl: envStr("REPO_STATE_GITHUB_API_BASE_URL", "https://api.github.com").trim(),
    hasGithubToken: Boolean(githubToken),
    readContent: envBool("REPO_STATE_READ_CONTENT", true),
    maxFileSize: envInt("REPO_STATE_MAX_FILE_SIZE", 200_000),
    maxContentFiles: envInt("REPO_STATE_MAX_CONTENT_FILES", 500),
    includePatterns: [],
    excludePatterns: ["node_modules", ".git", "dist", "build", ".cache"],
    contentExtensions: [".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".yml", ".yaml"],
  };
}

export default {
  getRepoStateConfig,
};
