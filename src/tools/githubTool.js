// AGENT NOTE:
// SG 2.0 free GitHub gateway tool.
// Purpose: let the AI model call GitHub REST API through SG runtime GitHub App authentication.
// This is intentionally a universal GitHub request gateway, not a set of narrow repo helpers.
// Secret auth values must never be returned to the model, logs, Telegram, or tool payloads.

import crypto from "crypto";
import { envStr } from "../config/env.js";
import { getGitHubAppAccess } from "../integrations/github/appAuth.js";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15000;
const APPROVAL_TTL_MS = 10 * 60 * 1000;

const pendingWriteApprovals = new Map();

function jsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ ok: false, error: "Failed to stringify GitHub tool result." });
  }
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeMethod(method) {
  return String(method || "GET").trim().toUpperCase();
}

function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";

  if (raw.startsWith("https://api.github.com/")) {
    return raw.slice("https://api.github.com".length);
  }

  if (raw.startsWith("api.github.com/")) {
    return raw.slice("api.github.com".length);
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function isWriteMethod(method) {
  return !["GET", "HEAD"].includes(normalizeMethod(method));
}

function cleanupExpiredApprovals() {
  const now = Date.now();

  for (const [approvalId, pending] of pendingWriteApprovals.entries()) {
    if (!pending?.expiresAt || pending.expiresAt <= now) {
      pendingWriteApprovals.delete(approvalId);
    }
  }
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function hashGitHubRequest({ method, path, query, body }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue({ method, path, query, body })))
    .digest("hex")
    .slice(0, 16);
}

function createApprovalId() {
  return `SG-WRITE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function extractGithubApprovalId(text = "") {
  const match = String(text || "")
    .trim()
    .match(/^МОЖНО\s+(SG-WRITE-[A-F0-9]{8,16})$/iu);

  return match ? match[1].toUpperCase() : null;
}

function getCurrentProjectRepository() {
  return envStr("GITHUB_REPO", "korzh260609-beep/garya-bot").trim();
}

function getCurrentProjectBranch() {
  return envStr("GITHUB_BRANCH", "dev/v2-start").trim();
}

function applyCurrentProjectDefaults({ method, path, query }) {
  const repository = getCurrentProjectRepository();
  const branch = getCurrentProjectBranch();

  if (!repository || !branch) return query;
  if (method !== "GET") return query;
  if (query?.ref) return query;

  const contentsPath = `/repos/${repository}/contents`;

  if (path === contentsPath || path.startsWith(`${contentsPath}/`)) {
    return {
      ...query,
      ref: branch,
    };
  }

  return query;
}

function applyCurrentProjectWriteDefaults({ method, path, body }) {
  const repository = getCurrentProjectRepository();
  const branch = getCurrentProjectBranch();

  if (!repository || !branch) return body;
  if (!isWriteMethod(method)) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  if (body.branch) return body;

  const contentsPath = `/repos/${repository}/contents/`;

  if (path.startsWith(contentsPath)) {
    return {
      ...body,
      branch,
    };
  }

  return body;
}

function appendQuery(url, query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return url;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const qs = params.toString();
  if (!qs) return url;

  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

async function readResponse(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function summarizeGitHubWriteRequest({ method, path, query, body }) {
  const currentBranch = getCurrentProjectBranch();
  const contentsMatch = path.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/?(.*)$/);
  const repoMatch = path.match(/^\/repos\/([^/]+\/[^/]+)/);
  const repo = contentsMatch?.[1] || repoMatch?.[1] || "unknown";
  const target = contentsMatch?.[2] ? decodeURIComponent(contentsMatch[2]) : path;
  const branch = body?.branch || query?.ref || currentBranch || "unknown";
  const bodyKeys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).sort() : [];

  let action = `${method} ${path}`;

  if (contentsMatch) {
    if (method === "PUT") action = "create/update file through GitHub contents API";
    if (method === "DELETE") action = "delete file through GitHub contents API";
  }

  return {
    repo,
    branch,
    action,
    target,
    method,
    path,
    query,
    body_keys: bodyKeys,
    possible_impact: [
      "repository files or metadata may change",
      "Render deployment may be affected if runtime files are changed",
      "future SG behavior may change if core files are changed",
    ],
  };
}

function buildApprovalWarning({ approvalId, summary, requestHash }) {
  return [
    "⚠️ Работа с GitHub-репозиторием подготовлена, но НЕ выполнена.",
    "",
    `approval: ${approvalId}`,
    `request_hash: ${requestHash}`,
    `repo: ${summary.repo}`,
    `branch: ${summary.branch}`,
    `action: ${summary.action}`,
    `target: ${summary.target}`,
    "",
    "На что может повлиять:",
    "- файлы или метаданные репозитория могут измениться;",
    "- если меняются runtime-файлы, может измениться поведение SG;",
    "- если меняются deploy-файлы, может измениться Render-запуск.",
    "",
    "Выбери действие кнопкой ниже.",
    "Резервный вариант для выполнения:",
    `МОЖНО ${approvalId}`,
  ].join("\n");
}

async function executeGitHubApiRequest({ method, path, query, body, headers }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const url = appendQuery(`${GITHUB_API_BASE}${path}`, query);

  try {
    const token = await getGitHubAppAccess();
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sg2-free-github-gateway",
        ...(headers && typeof headers === "object" && !Array.isArray(headers) ? headers : {}),
      },
      body: body === null || body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await readResponse(response);

    return {
      ok: response.ok,
      status: response.status,
      method,
      path,
      query,
      data,
      error: response.ok
        ? null
        : typeof data === "object" && data?.message
          ? data.message
          : `GitHub API HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      method,
      path,
      query,
      error: error?.name === "AbortError" ? "GitHub request timed out." : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function prepareGithubWriteApproval({ method, path, query, body, headers }, context = {}) {
  cleanupExpiredApprovals();

  if (!context?.isMonarch) {
    return {
      ok: false,
      status: 403,
      method,
      path,
      query,
      requires_approval: true,
      executed: false,
      error: "Only the Monarch can prepare GitHub write operations.",
    };
  }

  const request = { method, path, query, body, headers };
  const requestHash = hashGitHubRequest(request);
  const userId = context.userId ? String(context.userId) : "unknown";

  for (const [existingId, pending] of pendingWriteApprovals.entries()) {
    if (pending.requestHash === requestHash && pending.userId === userId) {
      const warning = buildApprovalWarning({
        approvalId: existingId,
        summary: pending.summary,
        requestHash,
      });

      return {
        ok: true,
        status: 202,
        method,
        path,
        query,
        requires_approval: true,
        executed: false,
        approval_id: existingId,
        request_hash: requestHash,
        confirmation_phrase: `МОЖНО ${existingId}`,
        expires_at: new Date(pending.expiresAt).toISOString(),
        summary: pending.summary,
        warning,
      };
    }
  }

  const approvalId = createApprovalId();
  const summary = summarizeGitHubWriteRequest({ method, path, query, body });
  const expiresAt = Date.now() + APPROVAL_TTL_MS;

  pendingWriteApprovals.set(approvalId, {
    approvalId,
    userId,
    request,
    requestHash,
    summary,
    createdAt: Date.now(),
    expiresAt,
  });

  const warning = buildApprovalWarning({ approvalId, summary, requestHash });

  return {
    ok: true,
    status: 202,
    method,
    path,
    query,
    requires_approval: true,
    executed: false,
    approval_id: approvalId,
    request_hash: requestHash,
    confirmation_phrase: `МОЖНО ${approvalId}`,
    expires_at: new Date(expiresAt).toISOString(),
    summary,
    warning,
  };
}

export async function executePendingGithubApproval(approvalId, context = {}) {
  cleanupExpiredApprovals();

  const normalizedApprovalId = String(approvalId || "").trim().toUpperCase();

  if (!normalizedApprovalId) {
    return {
      ok: false,
      status: 400,
      executed: false,
      error: "GitHub approval id is required.",
    };
  }

  if (!context?.isMonarch) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "Only the Monarch can execute GitHub write approvals.",
    };
  }

  const pending = pendingWriteApprovals.get(normalizedApprovalId);

  if (!pending) {
    return {
      ok: false,
      status: 404,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval was not found or expired.",
    };
  }

  const userId = context.userId ? String(context.userId) : "unknown";

  if (pending.userId !== userId) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval belongs to another user/session.",
    };
  }

  pendingWriteApprovals.delete(normalizedApprovalId);

  const result = await executeGitHubApiRequest(pending.request);

  return {
    ...result,
    approval_id: normalizedApprovalId,
    request_hash: pending.requestHash,
    requires_approval: false,
    executed: true,
    summary: pending.summary,
  };
}

export function cancelPendingGithubApproval(approvalId, context = {}) {
  cleanupExpiredApprovals();

  const normalizedApprovalId = String(approvalId || "").trim().toUpperCase();

  if (!normalizedApprovalId) {
    return {
      ok: false,
      status: 400,
      executed: false,
      error: "GitHub approval id is required.",
    };
  }

  if (!context?.isMonarch) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "Only the Monarch can cancel GitHub write approvals.",
    };
  }

  const pending = pendingWriteApprovals.get(normalizedApprovalId);

  if (!pending) {
    return {
      ok: false,
      status: 404,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval was not found or expired.",
    };
  }

  const userId = context.userId ? String(context.userId) : "unknown";

  if (pending.userId !== userId) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval belongs to another user/session.",
    };
  }

  pendingWriteApprovals.delete(normalizedApprovalId);

  return {
    ok: true,
    status: 200,
    approval_id: normalizedApprovalId,
    executed: false,
    cancelled: true,
    summary: pending.summary,
  };
}

export async function githubRequest(input = {}, context = {}) {
  const normalizedMethod = normalizeMethod(input.method);
  const normalizedPath = normalizePath(input.path);
  const parsedQuery = parseJsonObject(input.queryJson ?? input.query, {});
  const query = applyCurrentProjectDefaults({
    method: normalizedMethod,
    path: normalizedPath,
    query: parsedQuery,
  });
  const parsedBody = parseJsonObject(input.bodyJson ?? input.body, null);
  const body = applyCurrentProjectWriteDefaults({
    method: normalizedMethod,
    path: normalizedPath,
    body: parsedBody,
  });
  const headers = parseJsonObject(input.headersJson ?? input.headers, {});

  if (!normalizedPath) {
    return {
      ok: false,
      error: "GitHub request path is required.",
    };
  }

  if (isWriteMethod(normalizedMethod)) {
    const approvalIdFromText = extractGithubApprovalId(context.latestUserText);

    if (approvalIdFromText) {
      return executePendingGithubApproval(approvalIdFromText, context);
    }

    return prepareGithubWriteApproval(
      {
        method: normalizedMethod,
        path: normalizedPath,
        query,
        body,
        headers,
      },
      context
    );
  }

  return executeGitHubApiRequest({
    method: normalizedMethod,
    path: normalizedPath,
    query,
    body,
    headers,
  });
}

export async function runGithubTool(name, args = {}, context = {}) {
  if (name === "github_request") return githubRequest(args, context);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
