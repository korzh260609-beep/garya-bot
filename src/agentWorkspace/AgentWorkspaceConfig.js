// src/agentWorkspace/AgentWorkspaceConfig.js
// ============================================================================
// Agent workspace config.
// PURPOSE:
// - allow SG to write diagnostic markdown reports only into agent_workspace/
// - fail closed by default
// - never write source code, pillars, env, or arbitrary paths
// - allow broad read-only diagnostics without allowing mutations
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function normalizeCommandName(value) {
  const raw = normalizeString(value).split(/\s+/)[0];
  if (!raw.startsWith("/")) return "";
  return raw.split("@")[0];
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
  "/pm_wiring_diag",
  "/memory_monarch_diag",
]);

export const AGENT_WORKSPACE_DIAGNOSTIC_DENY_TOKENS = Object.freeze([
  "write",
  "set",
  "update",
  "delete",
  "remove",
  "archive",
  "remember",
  "restore",
  "backfill",
  "reclassify",
  "run",
  "stop",
  "new",
  "confirm",
  "link",
  "release",
  "refund",
  "clear",
  "reset",
  "sync",
  "upsert",
  "create",
]);

export function isAgentWorkspaceReadOnlyDiagnosticCommand(value) {
  const cmd = normalizeCommandName(value);
  if (!cmd) return false;

  const lower = cmd.toLowerCase();

  const hasDeniedToken = AGENT_WORKSPACE_DIAGNOSTIC_DENY_TOKENS.some((token) => {
    return lower.includes(`_${token}`) || lower.includes(`${token}_`) || lower.endsWith(`_${token}`);
  });

  if (hasDeniedToken) {
    return false;
  }

  if (AGENT_WORKSPACE_ALLOWED_DIAGNOSTIC_COMMANDS.includes(cmd)) {
    return true;
  }

  if (lower.endsWith("_diag")) {
    return true;
  }

  if (lower.startsWith("/diag_")) {
    return true;
  }

  if (lower.startsWith("/diagnose_")) {
    return true;
  }

  return false;
}

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
    diagnosticDenyTokens: AGENT_WORKSPACE_DIAGNOSTIC_DENY_TOKENS,
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
    diagnosticDenyTokens: cfg.diagnosticDenyTokens,
  };
}

export default {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
  isAgentWorkspaceReadOnlyDiagnosticCommand,
};
