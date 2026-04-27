// src/simpleAgents/repoStateAgent/RepoStateAgentWebhookHandler.js
// ============================================================================
// Repo State Agent Webhook Handler (secure)
// ============================================================================

import crypto from "crypto";
import RepoStateAgentService from "./RepoStateAgentService.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

function verifyGithubSignature(req, secret) {
  const signature = req.headers["x-hub-signature-256"] || "";
  if (!signature || !secret) return false;

  const body = JSON.stringify(req.body);
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function handleRepoStateAgentWebhook(req, res) {
  const config = getRepoStateAgentConfig();

  if (!config.enabled) {
    return res.status(503).json({ ok: false, error: "repo_state_agent_disabled" });
  }

  if (config.requireGithubSignature) {
    const valid = verifyGithubSignature(req, config.githubWebhookSecret);

    if (!valid) {
      return res.status(403).json({ ok: false, error: "invalid_github_signature" });
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
