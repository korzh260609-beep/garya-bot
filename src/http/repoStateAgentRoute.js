// src/http/repoStateAgentRoute.js
// ============================================================================
// Repo State Agent HTTP Route
// Separate route for the dedicated repo-state agent.
// ============================================================================

import express from "express";
import { handleRepoStateAgentWebhook } from "../simpleAgents/repoStateAgent/RepoStateAgentWebhookHandler.js";

export function createRepoStateAgentRoute() {
  const router = express.Router();

  router.post("/internal/repo-state-agent/github-push", handleRepoStateAgentWebhook);

  return router;
}

export default createRepoStateAgentRoute;
