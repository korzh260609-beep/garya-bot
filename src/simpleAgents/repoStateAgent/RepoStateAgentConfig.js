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
  };
}

export default {
  getRepoStateAgentConfig,
};
