// src/agentWorkspace/AgentWorkspaceGitHubClient.js
// ============================================================================
// Minimal GitHub contents client for agent_workspace markdown reports only.
// ============================================================================

import fetch from "node-fetch";
import { getAgentWorkspaceConfig } from "./AgentWorkspaceConfig.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toBase64Utf8(text) {
  return Buffer.from(String(text || ""), "utf8").toString("base64");
}

function fromBase64Utf8(text) {
  return Buffer.from(String(text || ""), "base64").toString("utf8");
}

function safePathPart(value) {
  const s = normalizeString(value);
  if (!s) return "";
  return s.replace(/^\/+/, "").replace(/\/+/g, "/");
}

function isGithubNotFoundError(error) {
  return String(error?.message || "").startsWith("github_http_404:");
}

function encodeCompareRef(value) {
  return encodeURIComponent(normalizeString(value));
}

export class AgentWorkspaceGitHubClient {
  constructor({ config } = {}) {
    this.config = config || getAgentWorkspaceConfig();
  }

  ensureReady() {
    if (!this.config.enabled) {
      throw new Error("agent_workspace_disabled");
    }

    if (!this.config.githubToken) {
      throw new Error("agent_workspace_github_token_missing");
    }

    if (!this.config.repoFullName) {
      throw new Error("agent_workspace_repo_missing");
    }
  }

  buildFilePath(fileName) {
    const base = safePathPart(this.config.basePath || "agent_workspace");
    const file = safePathPart(fileName);
    return `${base}/${file}`;
  }

  buildContentsUrl(fileName) {
    const path = this.buildFilePath(fileName)
      .split("/")
      .map((x) => encodeURIComponent(x))
      .join("/");

    return `${this.config.githubApiBaseUrl}/repos/${this.config.repoFullName}/contents/${path}`;
  }

  buildCompareUrl(base, head) {
    return `${this.config.githubApiBaseUrl}/repos/${this.config.repoFullName}/compare/${encodeCompareRef(base)}...${encodeCompareRef(head)}`;
  }

  async request(url, options = {}) {
    this.ensureReady();

    const response = await fetch(url, {
      ...options,
      headers: {
        authorization: `Bearer ${this.config.githubToken}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let parsed = null;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      throw new Error(
        `github_http_${response.status}: ${
          typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)
        }`
      );
    }

    return parsed;
  }

  async readFile(fileName) {
    const url = this.buildContentsUrl(fileName);
    const result = await this.request(`${url}?ref=${encodeURIComponent(this.config.branch)}`);

    return {
      ok: true,
      fileName,
      path: result?.path || this.buildFilePath(fileName),
      sha: result?.sha || null,
      content: result?.content ? fromBase64Utf8(result.content) : "",
    };
  }

  async compareCommits(base, head) {
    const normalizedBase = normalizeString(base);
    const normalizedHead = normalizeString(head);

    if (!normalizedBase || !normalizedHead) {
      return {
        ok: false,
        base: normalizedBase,
        head: normalizedHead,
        status: "missing_ref",
        aheadBy: null,
        behindBy: null,
      };
    }

    const result = await this.request(this.buildCompareUrl(normalizedBase, normalizedHead));

    return {
      ok: true,
      base: normalizedBase,
      head: normalizedHead,
      status: result?.status || "unknown",
      aheadBy: Number.isFinite(Number(result?.ahead_by)) ? Number(result.ahead_by) : null,
      behindBy: Number.isFinite(Number(result?.behind_by)) ? Number(result.behind_by) : null,
      totalCommits: Number.isFinite(Number(result?.total_commits)) ? Number(result.total_commits) : null,
      mergeBaseCommit: result?.merge_base_commit?.sha || null,
      baseCommit: result?.base_commit?.sha || null,
    };
  }

  async getCurrentFileForWrite(fileName) {
    try {
      return await this.readFile(fileName);
    } catch (error) {
      if (!isGithubNotFoundError(error)) {
        throw error;
      }

      return {
        ok: false,
        missing: true,
        fileName,
        path: this.buildFilePath(fileName),
        sha: null,
        content: "",
      };
    }
  }

  async writeFile(fileName, content, message) {
    const url = this.buildContentsUrl(fileName);
    const current = await this.getCurrentFileForWrite(fileName);

    if (this.config.dryRun) {
      return {
        ok: true,
        dryRun: true,
        fileName,
        path: current.path,
        sha: current.sha,
        created: Boolean(current.missing),
      };
    }

    const body = {
      message: `${this.config.commitPrefix} ${message || `update ${fileName}`}`,
      content: toBase64Utf8(content),
      branch: this.config.branch,
    };

    if (current.sha) {
      body.sha = current.sha;
    }

    const result = await this.request(url, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return {
      ok: true,
      dryRun: false,
      fileName,
      path: result?.content?.path || current.path,
      commitSha: result?.commit?.sha || null,
      created: Boolean(current.missing),
    };
  }
}

export default AgentWorkspaceGitHubClient;
