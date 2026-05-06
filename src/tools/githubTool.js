// AGENT NOTE:
// SG 2.0 free GitHub gateway tool.
// Purpose: let the AI model call GitHub REST API through SG runtime GitHub App authentication.
// This is intentionally a universal GitHub request gateway, not a set of narrow repo helpers.
// Secret auth values must never be returned to the model, logs, Telegram, or tool payloads.

import { envStr } from "../config/env.js";
import { getGitHubAppAccess } from "../integrations/github/appAuth.js";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15000;

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

export async function githubRequest(input = {}) {
  const normalizedMethod = normalizeMethod(input.method);
  const normalizedPath = normalizePath(input.path);
  const parsedQuery = parseJsonObject(input.queryJson ?? input.query, {});
  const query = applyCurrentProjectDefaults({
    method: normalizedMethod,
    path: normalizedPath,
    query: parsedQuery,
  });
  const body = parseJsonObject(input.bodyJson ?? input.body, null);
  const headers = parseJsonObject(input.headersJson ?? input.headers, {});

  if (!normalizedPath) {
    return {
      ok: false,
      error: "GitHub request path is required.",
    };
  }

  const token = await getGitHubAppAccess();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const url = appendQuery(`${GITHUB_API_BASE}${normalizedPath}`, query);

  try {
    const response = await fetch(url, {
      method: normalizedMethod,
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
      method: normalizedMethod,
      path: normalizedPath,
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
      method: normalizedMethod,
      path: normalizedPath,
      query,
      error: error?.name === "AbortError" ? "GitHub request timed out." : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGithubTool(name, args = {}) {
  if (name === "github_request") return githubRequest(args);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
