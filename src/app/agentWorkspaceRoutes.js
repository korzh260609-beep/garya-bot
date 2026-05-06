// AGENT NOTE:
// SG 2.0 Agent Workspace HTTP trigger routes.
// Purpose: event-driven/manual execution for agent_workspace/COMMANDS.md.
// Do not add Telegram, AI, DB, source-code writes, pillars writes, or Render write/deploy actions here.

import crypto from "crypto";
import { agentWorkspaceCommandReader } from "../agents/shared/workspace/AgentWorkspaceCommandReader.js";
import { agentWorkspaceCommandRunner } from "../agents/shared/workspace/AgentWorkspaceCommandRunner.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function getAgentWorkspaceHttpConfig() {
  const enabled = envBool("AGENT_WORKSPACE_ENABLED", false);
  const webhookEnabled = envBool("AGENT_WORKSPACE_WEBHOOK_ENABLED", false);
  const token = normalizeString(process.env.AGENT_WORKSPACE_WEBHOOK_TOKEN || "");

  return {
    enabled,
    webhookEnabled,
    token,
    ready: Boolean(enabled && webhookEnabled && token),
  };
}

function getProvidedToken(req) {
  const headerToken = normalizeString(req.headers["x-agent-workspace-token"]);
  const queryToken = normalizeString(req.query?.token);
  return headerToken || queryToken;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyGitHubSignature(req, secret) {
  const signature = normalizeString(req.headers["x-hub-signature-256"] || "");
  if (!signature || !signature.startsWith("sha256=")) return false;

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  return safeEqual(signature, expected);
}

function isAuthorized(req, cfg) {
  if (!cfg.ready) return false;

  if (verifyGitHubSignature(req, cfg.token)) {
    return true;
  }

  const providedToken = getProvidedToken(req);
  return Boolean(providedToken && safeEqual(providedToken, cfg.token));
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
      const arr = Array.isArray(payload.head_commit?.[key]) ? payload.head_commit[key] : [];
      files.push(...arr.map((x) => String(x || "")));
    }
  }

  return Array.from(new Set(files.filter(Boolean)));
}

function shouldRunForPayload(payload = {}) {
  return changedFilesFromPayload(payload).includes("agent_workspace/COMMANDS.md");
}

function buildForbiddenResponse(req, cfg) {
  return {
    ok: false,
    error: "forbidden",
    enabled: cfg.enabled,
    webhookEnabled: cfg.webhookEnabled,
    ready: cfg.ready,
    hasSignature: Boolean(req.headers["x-hub-signature-256"]),
    hasLegacyToken: Boolean(getProvidedToken(req)),
  };
}

async function runWorkspaceCommandOnce(source) {
  const readResult = await agentWorkspaceCommandReader.readParsedCommand();

  if (!readResult.ok) {
    return {
      ok: false,
      source,
      reason: readResult.reason,
      readResult,
    };
  }

  const result = await agentWorkspaceCommandRunner.executeParsedCommand(readResult.command);

  return {
    ok: result?.ok !== false,
    source,
    commandId: result?.commandId || readResult.command?.commandId || "NONE",
    action: result?.action || readResult.command?.action || "NONE",
    result,
  };
}

export function attachAgentWorkspaceRoutes(app) {
  app.post("/agent-workspace/github-webhook", async (req, res) => {
    const cfg = getAgentWorkspaceHttpConfig();

    if (!isAuthorized(req, cfg)) {
      return res.status(403).json(buildForbiddenResponse(req, cfg));
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

    const result = await runWorkspaceCommandOnce("github_webhook");
    return res.status(result.ok ? 200 : 500).json(result);
  });

  app.post("/agent-workspace/run-once", async (req, res) => {
    const cfg = getAgentWorkspaceHttpConfig();

    if (!isAuthorized(req, cfg)) {
      return res.status(403).json(buildForbiddenResponse(req, cfg));
    }

    const result = await runWorkspaceCommandOnce("manual_http_trigger");
    return res.status(result.ok ? 200 : 500).json(result);
  });

  app.get("/agent-workspace/run-once", async (req, res) => {
    const cfg = getAgentWorkspaceHttpConfig();

    if (!isAuthorized(req, cfg)) {
      return res.status(403).json(buildForbiddenResponse(req, cfg));
    }

    const result = await runWorkspaceCommandOnce("manual_http_trigger");
    return res.status(result.ok ? 200 : 500).json(result);
  });

  return app;
}

export default {
  attachAgentWorkspaceRoutes,
};
