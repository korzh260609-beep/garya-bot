// AGENT NOTE:
// SG 2.0 GitHub API client.
// Purpose: isolate GitHub REST transport/authentication from approval and tool wrapper logic.
// Do not add approval storage, behavior policy, or Telegram formatting here.

import { getGitHubAppAccess } from "../../integrations/github/appAuth.js";
import { formatGitHubActionsResult } from "../githubActionsFormatter.js";
import { appendQuery, readResponse } from "./githubRequestUtils.js";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15000;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getGitHubAccessToken() {
  const actionsToken = normalizeString(process.env.GITHUB_TOKEN);
  if (actionsToken) return actionsToken;

  return getGitHubAppAccess();
}

export async function executeGitHubApiRequest({ method, path, query, body, headers }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const url = appendQuery(`${GITHUB_API_BASE}${path}`, query);

  try {
    const token = await getGitHubAccessToken();
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
    const formatted = formatGitHubActionsResult({ method, path, query, data });

    return {
      ok: response.ok,
      status: response.status,
      method,
      path,
      query,
      data,
      formatted,
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
