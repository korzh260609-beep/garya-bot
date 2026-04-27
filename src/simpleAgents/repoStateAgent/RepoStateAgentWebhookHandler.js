// src/simpleAgents/repoStateAgent/RepoStateAgentWebhookHandler.js
// ============================================================================
// Repo State Agent Webhook Handler
// ============================================================================

import RepoStateAgentService from "./RepoStateAgentService.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

export async function handleRepoStateAgentWebhook(req, res) {
  const config = getRepoStateAgentConfig();

  if (!config.enabled) {
    return res.status(503).json({ ok: false, error: "repo_state_agent_disabled" });
  }

  if (config.webhookEnabled) {
    const token = req.headers["x-repo-state-agent-token"] || "";

    if (!config.webhookReady || token !== config.webhookToken) {
      return res.status(403).json({ ok: false, error: "invalid_webhook_token" });
    }
  }

  try {
    const agent = new RepoStateAgentService();
    const result = await agent.run();

    return res.status(200).json({
      ok: true,
      persisted: result?.persisted === true,
      scanRunId: result?.persistence?.scanRunId || null,
      filesCount: result?.filesCount || 0,
      modulesCount: result?.modulesCount || 0,
      dependenciesCount: result?.dependenciesCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "repo_state_agent_failed",
    });
  }
}

export default handleRepoStateAgentWebhook;
