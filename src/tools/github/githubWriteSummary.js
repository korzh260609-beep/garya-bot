// AGENT NOTE:
// SG 2.0 GitHub write summary helpers.
// Purpose: isolate semantic approval-context parsing and write-summary construction.
// Do not add approval state, GitHub API calls, behavior policy, or Telegram formatting here.

import { parseJsonObject } from "./githubRequestUtils.js";

export function normalizeStringArray(value) {
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

export function parseApprovalContext(value) {
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

function getShortAction(method) {
  if (method === "PUT") return "создать/обновить файл";
  if (method === "DELETE") return "удалить файл";
  if (method === "POST") return "создать объект/запись";
  if (method === "PATCH") return "изменить объект/запись";
  return method;
}

export function summarizeGitHubWriteRequest({ method, path, query, body, approvalContext, currentBranch }) {
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
