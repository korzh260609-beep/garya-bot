// src/simpleAgents/repoStateAgent/RepoStateAgentWebhookHandler.js
// ============================================================================
// Repo State Agent Webhook Handler (secure)
// ============================================================================

import crypto from "crypto";
import RepoStateAgentService from "./RepoStateAgentService.js";
import { getRepoStateAgentConfig } from "./RepoStateAgentConfig.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRefBranch(ref = "") {
  const normalized = normalizeString(ref);
  return normalized.startsWith("refs/heads/")
    ? normalized.slice("refs/heads/".length)
    : normalized;
}

function verifyGithubSignature(req, secret) {
  const signature = req.headers["x-hub-signature-256"] || "";
  if (!signature || !secret) return false;

  const body = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function readGithubEventName(req) {
  return normalizeString(req.headers["x-github-event"] || "").toLowerCase();
}

function buildPushTriggerMetadata(req) {
  const body = req.body || {};
  const repoFullName = normalizeString(body?.repository?.full_name || "");
  const ref = normalizeString(body?.ref || "");
  const branch = normalizeRefBranch(ref);
  const before = normalizeString(body?.before || "") || null;
  const after = normalizeString(body?.after || "") || null;
  const headCommitId = normalizeString(body?.head_commit?.id || "") || null;

  return {
    event: readGithubEventName(req),
    repoFullName,
    ref,
    branch,
    before,
    after,
    headCommitId,
    pusherName: normalizeString(body?.pusher?.name || "") || null,
    senderLogin: normalizeString(body?.sender?.login || "") || null,
  };
}

function isExpectedPush({ req, config }) {
  const event = readGithubEventName(req);
  if (event !== "push") {
    return {
      ok: false,
      status: 202,
      reason: "ignored_non_push_event",
      event,
    };
  }

  const metadata = buildPushTriggerMetadata(req);
  const expectedRepo = normalizeString(config.repoFullName);
  const expectedBranch = normalizeString(config.branch || "main") || "main";

  if (metadata.repoFullName !== expectedRepo) {
    return {
      ok: false,
      status: 202,
      reason: "ignored_unexpected_repo",
      metadata,
      expectedRepo,
    };
  }

  if (metadata.branch !== expectedBranch) {
    return {
      ok: false,
      status: 202,
      reason: "ignored_unexpected_branch",
      metadata,
      expectedBranch,
    };
  }

  return {
    ok: true,
    metadata,
  };
}

export async function handleRepoStateAgentWebhook(req, res) {
  const config = getRepoStateAgentConfig();

  if (!config.enabled) {
    return res.status(503).json({ ok: false, error: "repo_state_agent_disabled" });
  }

  if (!config.webhookEnabled) {
    return res.status(503).json({ ok: false, error: "repo_state_agent_webhook_disabled" });
  }

  if (config.requireGithubSignature) {
    const valid = verifyGithubSignature(req, config.githubWebhookSecret);

    if (!valid) {
      return res.status(403).json({ ok: false, error: "invalid_github_signature" });
    }
  }

  const expectedPush = isExpectedPush({ req, config });

  if (!expectedPush.ok) {
    return res.status(expectedPush.status || 202).json({
      ok: true,
      ignored: true,
      reason: expectedPush.reason,
      event: expectedPush.event || expectedPush.metadata?.event || null,
      repoFullName: expectedPush.metadata?.repoFullName || null,
      branch: expectedPush.metadata?.branch || null,
    });
  }

  try {
    const agent = new RepoStateAgentService();
    const result = await agent.run({
      triggerType: "github_push_webhook",
      triggerMetadata: expectedPush.metadata,
    });

    return res.status(200).json({
      ok: true,
      autoRefresh: true,
      persisted: result?.persisted === true,
      scanRunId: result?.persistence?.scanRunId || null,
      repoFullName: result?.repoFullName || config.repoFullName,
      branch: result?.branch || config.branch,
      commitSha: result?.commitSha || result?.projectMap?.repo?.commitSha || null,
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
