// AGENT NOTE:
// SG 2.0 runtime GitHub tool.
// Purpose: let the AI wrapper fetch repository and GitHub-wide facts through Render env GITHUB_TOKEN.
// This file gives broad GitHub read/search access through GitHub REST API.
// Do not place the token into prompts, logs, Telegram replies, or returned tool payloads.

import { envStr, requireEnv } from "../config/env.js";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

function getGithubToken() {
  return requireEnv("GITHUB_TOKEN");
}

function getDefaultRepo() {
  return envStr("GITHUB_REPO", "korzh260609-beep/garya-bot").trim();
}

function getDefaultBranch() {
  return envStr("GITHUB_BRANCH", "dev/v2-start").trim();
}

function normalizeRepo(value) {
  return String(value || getDefaultRepo()).trim();
}

function normalizeRef(value) {
  return String(value || getDefaultBranch()).trim();
}

function normalizePath(value) {
  return String(value || "").trim().replace(/^\/+/, "");
}

function normalizeQuery(value) {
  return String(value || "").trim();
}

function normalizePage(value) {
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function normalizePerPage(value) {
  const perPage = Number(value);
  if (!Number.isFinite(perPage) || perPage < 1) return DEFAULT_PER_PAGE;
  return Math.min(Math.floor(perPage), MAX_PER_PAGE);
}

function jsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ ok: false, error: "Failed to stringify GitHub tool result." });
  }
}

async function githubRequest(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${getGithubToken()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sg2-runtime-github-tool",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: typeof data === "object" && data?.message ? data.message : `GitHub API HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.name === "AbortError" ? "GitHub request timed out." : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function githubGetRepository({ repository } = {}) {
  const repo = normalizeRepo(repository);
  const url = `https://api.github.com/repos/${repo}`;
  const result = await githubRequest(url);

  if (!result.ok) return result;

  const item = result.data || {};
  return {
    ok: true,
    repository: repo,
    id: item.id,
    fullName: item.full_name,
    description: item.description,
    private: item.private,
    htmlUrl: item.html_url,
    defaultBranch: item.default_branch,
    language: item.language,
    stargazersCount: item.stargazers_count,
    forksCount: item.forks_count,
    openIssuesCount: item.open_issues_count,
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
  };
}

export async function githubGetBranch({ repository, branch } = {}) {
  const repo = normalizeRepo(repository);
  const ref = normalizeRef(branch);
  const url = `https://api.github.com/repos/${repo}/branches/${encodeURIComponent(ref)}`;
  return githubRequest(url);
}

export async function githubGetCommit({ repository, ref } = {}) {
  const repo = normalizeRepo(repository);
  const targetRef = normalizeRef(ref);
  const url = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(targetRef)}`;
  return githubRequest(url);
}

export async function githubListTree({ repository, ref } = {}) {
  const repo = normalizeRepo(repository);
  const targetRef = normalizeRef(ref);

  const branchResult = await githubGetBranch({ repository: repo, branch: targetRef });
  const treeSha = branchResult?.data?.commit?.commit?.tree?.sha;

  if (!branchResult.ok || !treeSha) {
    return {
      ok: false,
      error: branchResult?.error || "Could not resolve branch tree SHA.",
      branchResult,
    };
  }

  const url = `https://api.github.com/repos/${repo}/git/trees/${treeSha}?recursive=1`;
  const result = await githubRequest(url);

  if (!result.ok) return result;

  const files = Array.isArray(result.data?.tree)
    ? result.data.tree.map((item) => ({
        path: item.path,
        type: item.type,
        size: item.size ?? null,
        sha: item.sha ?? null,
      }))
    : [];

  return {
    ok: true,
    repository: repo,
    ref: targetRef,
    count: files.length,
    files,
  };
}

export async function githubFetchFile({ repository, ref, path } = {}) {
  const repo = normalizeRepo(repository);
  const targetRef = normalizeRef(ref);
  const filePath = normalizePath(path);

  if (!filePath) {
    return { ok: false, error: "path is required" };
  }

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(targetRef)}`;
  const result = await githubRequest(url);

  if (!result.ok) return result;

  const file = result.data;
  if (!file || file.type !== "file") {
    return { ok: false, error: "GitHub path is not a file.", data: file };
  }

  const content = file.encoding === "base64" && file.content
    ? Buffer.from(file.content, "base64").toString("utf8")
    : String(file.content || "");

  return {
    ok: true,
    repository: repo,
    ref: targetRef,
    path: filePath,
    sha: file.sha,
    size: file.size,
    encoding: file.encoding,
    content,
  };
}

export async function githubSearchCode({ repository, query, page, perPage } = {}) {
  const repo = normalizeRepo(repository);
  const q = normalizeQuery(query);

  if (!q) {
    return { ok: false, error: "query is required" };
  }

  const searchQuery = `${q} repo:${repo}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&page=${normalizePage(page)}&per_page=${normalizePerPage(perPage)}`;
  const result = await githubRequest(url);

  if (!result.ok) return result;

  const items = Array.isArray(result.data?.items)
    ? result.data.items.map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.html_url,
        score: item.score,
        repository: item.repository?.full_name,
      }))
    : [];

  return {
    ok: true,
    repository: repo,
    query: q,
    totalCount: result.data?.total_count ?? null,
    count: items.length,
    items,
  };
}

export async function githubSearchRepositories({ query, page, perPage, sort, order } = {}) {
  const q = normalizeQuery(query);

  if (!q) {
    return { ok: false, error: "query is required" };
  }

  const params = new URLSearchParams({
    q,
    page: String(normalizePage(page)),
    per_page: String(normalizePerPage(perPage)),
  });

  if (sort) params.set("sort", String(sort));
  if (order) params.set("order", String(order));

  const result = await githubRequest(`https://api.github.com/search/repositories?${params.toString()}`);

  if (!result.ok) return result;

  const items = Array.isArray(result.data?.items)
    ? result.data.items.map((item) => ({
        fullName: item.full_name,
        description: item.description,
        private: item.private,
        htmlUrl: item.html_url,
        defaultBranch: item.default_branch,
        language: item.language,
        stargazersCount: item.stargazers_count,
        forksCount: item.forks_count,
        openIssuesCount: item.open_issues_count,
        updatedAt: item.updated_at,
        pushedAt: item.pushed_at,
      }))
    : [];

  return {
    ok: true,
    query: q,
    totalCount: result.data?.total_count ?? null,
    count: items.length,
    items,
  };
}

export async function githubGlobalCodeSearch({ query, page, perPage, sort, order } = {}) {
  const q = normalizeQuery(query);

  if (!q) {
    return { ok: false, error: "query is required" };
  }

  const params = new URLSearchParams({
    q,
    page: String(normalizePage(page)),
    per_page: String(normalizePerPage(perPage)),
  });

  if (sort) params.set("sort", String(sort));
  if (order) params.set("order", String(order));

  const result = await githubRequest(`https://api.github.com/search/code?${params.toString()}`);

  if (!result.ok) return result;

  const items = Array.isArray(result.data?.items)
    ? result.data.items.map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.html_url,
        score: item.score,
        repository: item.repository?.full_name,
      }))
    : [];

  return {
    ok: true,
    query: q,
    totalCount: result.data?.total_count ?? null,
    count: items.length,
    items,
  };
}

export async function githubSearchIssues({ query, page, perPage, sort, order } = {}) {
  const q = normalizeQuery(query);

  if (!q) {
    return { ok: false, error: "query is required" };
  }

  const params = new URLSearchParams({
    q,
    page: String(normalizePage(page)),
    per_page: String(normalizePerPage(perPage)),
  });

  if (sort) params.set("sort", String(sort));
  if (order) params.set("order", String(order));

  const result = await githubRequest(`https://api.github.com/search/issues?${params.toString()}`);

  if (!result.ok) return result;

  const items = Array.isArray(result.data?.items)
    ? result.data.items.map((item) => ({
        title: item.title,
        state: item.state,
        url: item.html_url,
        repositoryUrl: item.repository_url,
        user: item.user?.login,
        labels: Array.isArray(item.labels) ? item.labels.map((label) => label.name) : [],
        comments: item.comments,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        score: item.score,
      }))
    : [];

  return {
    ok: true,
    query: q,
    totalCount: result.data?.total_count ?? null,
    count: items.length,
    items,
  };
}

export async function runGithubTool(name, args = {}) {
  if (name === "github_get_repository") return githubGetRepository(args);
  if (name === "github_get_branch") return githubGetBranch(args);
  if (name === "github_get_commit") return githubGetCommit(args);
  if (name === "github_list_tree") return githubListTree(args);
  if (name === "github_fetch_file") return githubFetchFile(args);
  if (name === "github_search_code") return githubSearchCode(args);
  if (name === "github_search_repositories") return githubSearchRepositories(args);
  if (name === "github_global_code_search") return githubGlobalCodeSearch(args);
  if (name === "github_search_issues") return githubSearchIssues(args);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
