// src/repoStateCollector/RepoStateGitHubClient.js
// ============================================================================
// Repo State GitHub Client
// Read-only GitHub API adapter for Repo State Collector.
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fromBase64Utf8(value) {
  return Buffer.from(String(value || ""), "base64").toString("utf8");
}

function buildHeaders(token) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return headers;
}

function splitRepoFullName(repoFullName) {
  const [owner, repo] = normalizeString(repoFullName).split("/");
  return { owner, repo };
}

export class RepoStateGitHubClient {
  constructor({ token, apiBaseUrl = "https://api.github.com" } = {}) {
    this.token = normalizeString(token);
    this.apiBaseUrl = normalizeString(apiBaseUrl) || "https://api.github.com";
  }

  async requestJson(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(this.token),
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(`github_request_failed:${response.status}:${typeof data === "string" ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
    }

    return data;
  }

  async readTree({ repoFullName, branch = "main", recursive = true } = {}) {
    const { owner, repo } = splitRepoFullName(repoFullName);
    if (!owner || !repo) {
      throw new Error("repo_state_github_client_invalid_repo_full_name");
    }

    const refUrl = `${this.apiBaseUrl}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
    const ref = await this.requestJson(refUrl);
    const treeSha = ref?.object?.sha;

    if (!treeSha) {
      throw new Error("repo_state_github_client_missing_tree_sha");
    }

    const treeUrl = `${this.apiBaseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}${recursive ? "?recursive=1" : ""}`;
    const tree = await this.requestJson(treeUrl);

    return {
      ok: true,
      repoFullName,
      branch,
      treeSha,
      tree: Array.isArray(tree?.tree) ? tree.tree : [],
      truncated: tree?.truncated === true,
    };
  }

  async readFile({ repoFullName, branch = "main", path } = {}) {
    const { owner, repo } = splitRepoFullName(repoFullName);
    const safePath = normalizeString(path).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

    if (!owner || !repo || !safePath) {
      throw new Error("repo_state_github_client_invalid_read_file_args");
    }

    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${safePath}?ref=${encodeURIComponent(branch)}`;
    const data = await this.requestJson(url);

    return {
      path,
      sha: data?.sha || null,
      size: Number.isFinite(Number(data?.size)) ? Number(data.size) : null,
      encoding: data?.encoding || null,
      content: data?.encoding === "base64" ? fromBase64Utf8(data?.content || "") : String(data?.content || ""),
    };
  }
}

export default RepoStateGitHubClient;
