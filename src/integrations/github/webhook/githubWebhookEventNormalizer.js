// src/integrations/github/webhook/githubWebhookEventNormalizer.js
// SG 2.0 — GitHub webhook event normalizer skeleton.
// Purpose: convert signed GitHub webhook payloads into bounded internal nervous-system events.
// Do not add Express routes, signature verification, AI calls, DB writes, Project Memory writes, raw payload logging, or autonomous behavior here.

export const GITHUB_WEBHOOK_EVENT_NORMALIZER_VERSION = 1;

export const GITHUB_WEBHOOK_EVENT_TYPES = Object.freeze({
  PULL_REQUEST: "pull_request",
});

export const GITHUB_WEBHOOK_ACTIONS = Object.freeze({
  CLOSED: "closed",
});

export const GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES = Object.freeze({
  PR_MERGED: "github.pr_merged",
  IGNORED: "github.webhook_ignored",
});

function normalizeText(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildIgnored({ reason, githubEvent = "", action = "" } = {}) {
  return {
    ok: true,
    version: GITHUB_WEBHOOK_EVENT_NORMALIZER_VERSION,
    normalized: false,
    ignored: true,
    eventType: GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES.IGNORED,
    reason,
    githubEvent: normalizeText(githubEvent),
    action: normalizeText(action),
    rawPayloadExposed: false,
  };
}

export function normalizeGithubWebhookEvent({ githubEvent = "", payload = {} } = {}) {
  const eventName = normalizeText(githubEvent);
  const safePayload = normalizePlainObject(payload);
  const action = normalizeText(safePayload.action);

  if (eventName !== GITHUB_WEBHOOK_EVENT_TYPES.PULL_REQUEST) {
    return buildIgnored({
      reason: "unsupported_github_event",
      githubEvent: eventName,
      action,
    });
  }

  if (action !== GITHUB_WEBHOOK_ACTIONS.CLOSED) {
    return buildIgnored({
      reason: "unsupported_pull_request_action",
      githubEvent: eventName,
      action,
    });
  }

  const pullRequest = normalizePlainObject(safePayload.pull_request);
  const repository = normalizePlainObject(safePayload.repository);
  const base = normalizePlainObject(pullRequest.base);
  const head = normalizePlainObject(pullRequest.head);

  if (pullRequest.merged !== true) {
    return buildIgnored({
      reason: "pull_request_closed_without_merge",
      githubEvent: eventName,
      action,
    });
  }

  const baseBranch = normalizeText(base.ref);
  if (baseBranch !== "dev/v2-start") {
    return buildIgnored({
      reason: "pull_request_base_branch_not_dev_v2_start",
      githubEvent: eventName,
      action,
    });
  }

  const prNumber = normalizeNumber(pullRequest.number || safePayload.number);
  const title = normalizeText(pullRequest.title);
  const sourceRef = normalizeText(pullRequest.html_url || pullRequest.url);

  if (!prNumber || !title || !sourceRef) {
    return {
      ok: false,
      version: GITHUB_WEBHOOK_EVENT_NORMALIZER_VERSION,
      normalized: false,
      ignored: false,
      eventType: GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES.PR_MERGED,
      reason: "missing_required_pr_payload_fields",
      rawPayloadExposed: false,
    };
  }

  return {
    ok: true,
    version: GITHUB_WEBHOOK_EVENT_NORMALIZER_VERSION,
    normalized: true,
    ignored: false,
    eventType: GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES.PR_MERGED,
    githubEvent: eventName,
    action,
    payload: {
      prNumber,
      title,
      sourceRef,
      repositoryFullName: normalizeText(repository.full_name),
      baseBranch,
      headBranch: normalizeText(head.ref),
      headSha: normalizeText(head.sha),
      mergeCommitSha: normalizeText(pullRequest.merge_commit_sha),
      mergedAt: normalizeText(pullRequest.merged_at || pullRequest.closed_at),
      senderLogin: normalizeText(safePayload.sender?.login),
    },
    rawPayloadExposed: false,
  };
}

export default {
  GITHUB_WEBHOOK_EVENT_NORMALIZER_VERSION,
  GITHUB_WEBHOOK_EVENT_TYPES,
  GITHUB_WEBHOOK_ACTIONS,
  GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES,
  normalizeGithubWebhookEvent,
};
