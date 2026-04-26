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
  "COMMANDS.md",
  "INBOX.md",
  "STATUS.md",
  "LOOP_STATE.md",
  "DEPLOY_REPORT.md",
  "RENDER_REPORT.md",
  "RENDER_LOGS_REPORT.md",
  "RENDER_DEPLOYS_REPORT.md",
  "RENDER_DEPLOY_REPORT.md",
  "RENDER_STATUS_REPORT.md",
  "DIAGNOSIS.md",
  "TEST_REPORT.md",
  "PATCH_REQUESTS.md",
]);

export const AGENT_WORKSPACE_ALLOWED_ACTIONS = Object.freeze([
  "VERIFY_DEPLOY",
  "COLLECT_RENDER_REPORT",
  "COLLECT_RENDER_LOGS",
  "COLLECT_RENDER_DEPLOYS",
  "COLLECT_RENDER_DEPLOY",
  "COLLECT_RENDER_STATUS",
  "WRITE_TEST_NOTE",
  "RUN_DIAGNOSTIC_COMMANDS",
]);

export const AGENT_WORKSPACE_ALLOWED_DIAGNOSTIC_COMMANDS = Object.freeze([
  "/agent_workspace_diag",
  "/render_bridge_diag",
  "/render_bridge_services",
  "/render_bridge_deploys",
  "/render_bridge_logs",
  "/render_bridge_diagnose",
  "/pm_capabilities_diag",
  "/memory_remember_guard_diag",
  "/memory_long_term_read_diag",
  "/memory_confirmed_restore_diag",
  "/memory_archive_write_diag",
  "/memory_topic_digest_diag",
  "/memory_restore_before_answer_diag",
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
  const webhookEnabled = envBool("AGENT_WORKSPACE_WEBHOOK_ENABLED", false);
  const webhookToken = normalizeString(process.env.AGENT_WORKSPACE_WEBHOOK_TOKEN || "");

  return {
    enabled,
    dryRun,
    webhookEnabled,
    webhookToken,
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
    allowedActions: AGENT_WORKSPACE_ALLOWED_ACTIONS,
    allowedDiagnosticCommands: AGENT_WORKSPACE_ALLOWED_DIAGNOSTIC_COMMANDS,
    ready: Boolean(enabled && repoFullName && branch && basePath && githubToken),
    webhookReady: Boolean(
      enabled && webhookEnabled && webhookToken && repoFullName && branch && basePath && githubToken
    ),
  };
}

export function getAgentWorkspaceDiag() {
  const cfg = getAgentWorkspaceConfig();
  return {
    enabled: cfg.enabled,
    dryRun: cfg.dryRun,
    webhookEnabled: cfg.webhookEnabled,
    webhookReady: cfg.webhookReady,
    repoFullName: cfg.repoFullName,
    branch: cfg.branch,
    basePath: cfg.basePath,
    hasGithubToken: Boolean(cfg.githubToken),
    hasWebhookToken: Boolean(cfg.webhookToken),
    ready: cfg.ready,
    allowedFiles: cfg.allowedFiles,
    allowedActions: cfg.allowedActions,
    allowedDiagnosticCommands: cfg.allowedDiagnosticCommands,
  };
}

export default {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
};
