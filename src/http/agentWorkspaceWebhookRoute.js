// src/http/agentWorkspaceWebhookRoute.js
// ============================================================================
// GitHub webhook route for agent_workspace/COMMANDS.md changes.
// Event-driven: no cron, no polling.
// ============================================================================

import express from "express";
import { getAgentWorkspaceConfig } from "../agentWorkspace/AgentWorkspaceConfig.js";
import agentWorkspaceCommandRunner from "../agentWorkspace/AgentWorkspaceCommandRunner.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getProvidedToken(req) {
  const headerToken = normalizeString(req.headers["x-agent-workspace-token"]);
  const queryToken = normalizeString(req.query.token);
  return headerToken || queryToken;
}

function changedFilesFromPayload(payload = {}) {
  const files = [];
  const commits = Array.isArray(payload?.commits) ? payload.commits : [];

  for (const commit of commits) {
    for (const key of ["added", "modified", "removed"]) {
      const arr = Array.isArray(commit?.[key]) ? commit[key] : [];
      files.push(...arr.map((x) => String(x || "")));
    }
  }

  if (payload?.head_commit) {
    for (const key of ["added", "modified", "removed"]) {
      const arr = Array.isArray(payload.head_commit?.[key])
        ? payload.head_commit[key]
        : [];
      files.push(...arr.map((x) => String(x || "")));
    }
  }

  return Array.from(new Set(files.filter(Boolean)));
}

function shouldRunForPayload(payload = {}) {
  const files = changedFilesFromPayload(payload);
  return files.includes("agent_workspace/COMMANDS.md");
}

export function createAgentWorkspaceWebhookRoute() {
  const router = express.Router();

  router.post("/agent-workspace/github-webhook", async (req, res) => {
    const cfg = getAgentWorkspaceConfig();
    const providedToken = getProvidedToken(req);

    if (!cfg.webhookReady || !providedToken || providedToken !== cfg.webhookToken) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        webhookReady: cfg.webhookReady,
      });
    }

    const event = normalizeString(req.headers["x-github-event"] || "");

    if (event && event !== "push") {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "unsupported_event",
        event,
      });
    }

    if (!shouldRunForPayload(req.body || {})) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "commands_file_not_changed",
        event: event || "unknown",
      });
    }

    const result = await agentWorkspaceCommandRunner.runOnce({
      source: "github_webhook",
    });

    return res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      result,
    });
  });

  return router;
}

export default {
  createAgentWorkspaceWebhookRoute,
};
