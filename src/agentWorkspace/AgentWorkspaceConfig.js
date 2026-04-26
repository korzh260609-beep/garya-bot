// src/agentWorkspace/AgentWorkspaceConfig.js
// ============================================================================
// Agent workspace config.
// PURPOSE:
// - allow SG to write diagnostic markdown reports only into agent_workspace/
// - fail closed by default
// - never write source code, pillars, env, or arbitrary paths
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

export const AGENT_WORKSPACE_ALLOWED_FILES = Object.freeze([
  "INBOX.md",
  "STATUS.md",
  "LOOP_STATE.md",
  "DEPLOY_REPORT.md",
  "RENDER_REPORT.md",
  "DIAGNOSIS.md",
  "TEST_REPORT.md",
  "PATCH_REQUESTS.md",
]);

export function getAgentWorkspaceConfig() {
  const repoFullName =
    normalizeString(process.env.AGENT_WORKSPACE_REPO_FULL_NAME || "") ||
    "korzh260609-beep/garya-bot";

  const branch =
    normalizeString(process.env.AGENT_WORKSPACE_BRANCH || "") ||
    "main";

  const basePath =
    normalizeString(process.env.AGENT_WORKSPACE_BASE_PATH || "") ||
    "agent_workspace";

  const githubToken = normalizeString(
    process.env.AGENT_WORKSPACE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ""
  );

  const enabled = envBool("AGENT_WORKSPACE_ENABLED", false);
  const dryRun = envBool("AGENT_WORKSPACE_DRY_RUN", false);

  return {
    enabled,
    dryRun,
    repoFullName,
    branch,
    basePath,
    githubToken,
    githubApiBaseUrl:
      normalizeString(process.env.AGENT_WORKSPACE_GITHUB_API_BASE_URL || "") ||
      "https://api.github.com",
    commitPrefix:
      normalizeString(process.env.AGENT_WORKSPACE_COMMIT_PREFIX || "") ||
      "agent_workspace:",
    allowedFiles: AGENT_WORKSPACE_ALLOWED_FILES,
    ready: Boolean(enabled && repoFullName && branch && basePath && githubToken),
  };
}

export function getAgentWorkspaceDiag() {
  const cfg = getAgentWorkspaceConfig();
  return {
    enabled: cfg.enabled,
    dryRun: cfg.dryRun,
    repoFullName: cfg.repoFullName,
    branch: cfg.branch,
    basePath: cfg.basePath,
    hasGithubToken: Boolean(cfg.githubToken),
    ready: cfg.ready,
    allowedFiles: cfg.allowedFiles,
  };
}

export default {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
};
