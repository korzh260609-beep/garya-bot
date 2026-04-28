// src/simpleAgents/repoStateAgent/RepoStateAgentConfig.js
// ============================================================================
// Repo State Agent Config
// ============================================================================

import { envStr } from "../../core/config.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(envStr(name, fallback ? "true" : "false")).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback) {
  const raw = normalizeString(envStr(name, String(fallback)));
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRepoStateAgentConfig() {
  const webhookToken = normalizeString(envStr("REPO_STATE_AGENT_WEBHOOK_TOKEN", ""));
  const githubWebhookSecret = normalizeString(envStr("REPO_STATE_AGENT_GITHUB_WEBHOOK_SECRET", webhookToken));

  return {
    enabled: envBool("REPO_STATE_AGENT_ENABLED", true),
    webhookEnabled: envBool("REPO_STATE_AGENT_WEBHOOK_ENABLED", false),
    webhookToken,
    webhookReady: Boolean(webhookToken || githubWebhookSecret),
    githubWebhookSecret,
    requireGithubSignature: envBool("REPO_STATE_AGENT_REQUIRE_GITHUB_SIGNATURE", true),

    // AI layer
    aiEnabled: envBool("REPO_STATE_AGENT_AI_ENABLED", false),
    aiDryRun: envBool("REPO_STATE_AGENT_AI_DRY_RUN", true),
    aiMaxPromptChars: envInt("REPO_STATE_AGENT_AI_MAX_PROMPT_CHARS", 30000),
    aiMaxModules: envInt("REPO_STATE_AGENT_AI_MAX_MODULES", 60),
    aiMaxModuleLinks: envInt("REPO_STATE_AGENT_AI_MAX_MODULE_LINKS", 60),
    aiMaxCommandLikeFiles: envInt("REPO_STATE_AGENT_AI_MAX_COMMAND_LIKE_FILES", 40),
    aiMaxCriticalFiles: envInt("REPO_STATE_AGENT_AI_MAX_CRITICAL_FILES", 40),
    aiCostLevel: normalizeString(envStr("REPO_STATE_AGENT_AI_COST_LEVEL", "high")) || "high",
  };
}

export default {
  getRepoStateAgentConfig,
};
