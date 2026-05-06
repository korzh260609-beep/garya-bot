// AGENT NOTE:
// SG 2.0 free GitHub gateway tool.
// Purpose: let the AI model call GitHub REST API through SG runtime GitHub App authentication.
// This is intentionally a universal GitHub request gateway, not a set of narrow repo helpers.
// Secret auth values must never be returned to the model, logs, Telegram, or tool payloads.

import crypto from "crypto";
import { evaluateActionPolicy } from "../behavior/actionPolicy.js";
import { SG_ACTION_TYPES } from "../behavior/actionTypes.js";
import { envStr } from "../config/env.js";
import {
  executeGitHubApiRequest,
  isWriteMethod,
  jsonStringify,
  normalizeMethod,
  normalizePath,
  parseJsonObject,
} from "./github/index.js";

const APPROVAL_TTL_MS = 10 * 60 * 1000;

const pendingWriteApprovals = new Map();

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

function getShortAction(method) {
  if (method === "PUT") return "создать/обновить файл";
  if (method === "DELETE") return "удалить файл";
  if (method === "POST") return "создать объект/запись";
  if (method === "PATCH") return "изменить объект/запись";
  return method;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function parseApprovalContext(value) {
  const parsed = parseJsonObject(value, null);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const changeSummary = String(parsed.change_summary || "").trim();
  const reason = String(parsed.reason || "").trim();
  const specificImpact = normalizeStringArray(parsed.specific_impact);

  if (!changeSummary || !reason || !specificImpact.length) {
    return null;
  }

  return {
    change_type: String(parsed.change_type || "change").trim() || "change",
    change_summary: changeSummary,
    reason,
    affected_files: normalizeStringArray(parsed.affected_files),
    affected_layers: normalizeStringArray(parsed.affected_layers),
    specific_impact: specificImpact,
    not_touched: normalizeStringArray(parsed.not_touched),
  };
}

function summarizeGitHubWriteRequest({ method, path, query, body, approvalContext }) {
  const currentBranch = getCurrentProjectBranch();
  const contentsMatch = path.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/?(.*)$/);
  const repoMatch = path.match(/^\/repos\/([^/]+\/[^/]+)/);
  const repo = contentsMatch?.[1] || repoMatch?.[1] || "unknown";
  const target = contentsMatch?.[2] ? decodeURIComponent(contentsMatch[2]) : path;
  const branch = body?.branch || query?.ref || currentBranch || "unknown";
  const bodyKeys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).sort() : [];

  let action = `${method} ${path}`;

  if (contentsMatch) {
    action = getShortAction(method);
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
    approval_context: approvalContext,
  };
}

function buildApprovalWarning({ approvalId, summary }) {
  const context = summary.approval_context || {};
  const affectedFiles = context.affected_files?.length ? context.affected_files : [summary.target];
  const affectedLayers = context.affected_layers?.length ? context.affected_layers : ["не указано"];
  const impactLines = context.specific_impact.map((item) => `- ${item}`);
  const notTouchedLines = context.not_touched?.length
    ? context.not_touched.map((item) => `- ${item}`)
    : [];

  return [
    "⚠️ Подтвердить GitHub-действие?",
    "",
    `repo: ${summary.repo}`,
    `branch: ${summary.branch}`,
    `тип: ${context.change_type}`,
    `действие: ${summary.action}`,
    "",
    "Что меняется:",
    context.change_summary,
    "",
    "Зачем:",
    context.reason,
    "",
    "Файлы:",
    ...affectedFiles.map((item) => `- ${item}`),
    "",
    "Затронутые слои:",
    ...affectedLayers.map((item) => `- ${item}`),
    "",
    "Конкретное влияние:",
    ...impactLines,
    ...(notTouchedLines.length ? ["", "Не трогаем:", ...notTouchedLines] : []),
    "",
    "Подтверди или отмени кнопкой ниже.",
    `id: ${approvalId}`,
  ].join("\n");
}

function buildIdentityFromContext(context = {}) {
  return {
    isMonarch: Boolean(context.isMonarch),
    role: context.role || "guest",
    platformUserId: context.userId || null,
    globalUserId: context.globalUserId || null,
  };
}

function evaluateGitHubWritePolicy({ context = {}, hasApproval = false }) {
  return evaluateActionPolicy({
    actionType: SG_ACTION_TYPES.MODIFY_REPO,
    identity: buildIdentityFromContext(context),
    hasApproval,
    hasSource: true,
    hasPlan: true,
  });
}

function prepareGithubWriteApproval({ method, path, query, body, headers, approvalContext }, context = {}) {
  cleanupExpiredApprovals();

  const policyCheck = evaluateGitHubWritePolicy({ context, hasApproval: false });

  if (!context?.isMonarch || !policyCheck.missing.includes("explicit_approval")) {
    return {
      ok: false,
      status: 403,
      method,
      path,
      query,
      requires_approval: true,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write preparation is blocked by SG behavior policy.",
    };
  }

  if (!approvalContext) {
    return {
      ok: false,
      status: 400,
      method,
      path,
      query,
      requires_approval: true,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write approval requires semantic approvalContextJson: change_summary, reason and specific_impact are required.",
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
        policy_check: policyCheck,
        warning,
      };
    }
  }

  const approvalId = createApprovalId();
  const summary = summarizeGitHubWriteRequest({ method, path, query, body, approvalContext });
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
    policy_check: policyCheck,
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

  const policyCheck = evaluateGitHubWritePolicy({ context, hasApproval: true });

  if (!policyCheck.ok) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write execution is blocked by SG behavior policy.",
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
    policy_check: policyCheck,
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
  const approvalContext = parseApprovalContext(input.approvalContextJson ?? input.approvalContext);

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
        approvalContext,
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
