// src/http/repoStateAgentRoute.js
// ============================================================================
// Repo State Agent HTTP Route
// Separate route for the dedicated repo-state agent.
// ============================================================================

import express from "express";
import { handleRepoStateAgentWebhook } from "../simpleAgents/repoStateAgent/RepoStateAgentWebhookHandler.js";
import { getRepoStateAgentConfig } from "../simpleAgents/repoStateAgent/RepoStateAgentConfig.js";
import { getLatestProjectMapState } from "../simpleAgents/repoStateAgent/RepoStateProjectMapStateRepository.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getProvidedToken(req) {
  const headerToken = normalizeString(req.headers["x-repo-state-agent-token"]);
  const queryToken = normalizeString(req.query.token);
  return headerToken || queryToken;
}

function isStatusRequestAllowed(req, config) {
  const expectedToken = normalizeString(config.webhookToken);
  const providedToken = getProvidedToken(req);

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

function buildLatestProjectMapStateView(row) {
  if (!row) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    id: row.id || null,
    scanRunId: row.scan_run_id || null,
    createdAt: row.created_at || null,
    hasProjectMapHash: Boolean(row.project_map_hash),
    projectMapHash: row.project_map_hash || null,
    aiEnabled: row.ai_enabled === true,
    status: row.status || null,
  };
}

export function createRepoStateAgentRoute() {
  const router = express.Router();

  router.post("/internal/repo-state-agent/github-push", handleRepoStateAgentWebhook);

  router.get("/internal/repo-state-agent/status", async (req, res) => {
    const config = getRepoStateAgentConfig();

    if (!isStatusRequestAllowed(req, config)) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    try {
      const latestProjectMapState = await getLatestProjectMapState(
        config.repoFullName,
        config.branch
      );

      return res.status(200).json({
        ok: true,
        repoFullName: config.repoFullName,
        branch: config.branch,
        enabled: config.enabled === true,
        webhookEnabled: config.webhookEnabled === true,
        latestProjectMapState: buildLatestProjectMapStateView(latestProjectMapState),
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "repo_state_agent_status_failed",
        message: error?.message || "unknown_error",
      });
    }
  });

  return router;
}

export default createRepoStateAgentRoute;
