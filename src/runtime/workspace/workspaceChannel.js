// AGENT NOTE:
// SG 2.0 workspace channel.
// Purpose: provide a narrow GitHub-backed file channel for runtime reports.
// Do not add task logic, Telegram handling, AI calls, polling, or provider-specific logic here.

import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function encodeBase64Utf8(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function decodeBase64Utf8(value) {
  return Buffer.from(String(value || ""), "base64").toString("utf8");
}

function safeWorkspacePath(path) {
  const normalized = normalizeString(path).replace(/^\/+/, "");
  if (!normalized) throw new Error("workspace_path_missing");
  if (normalized.includes("..")) throw new Error("workspace_path_not_allowed");
  if (!normalized.startsWith("runtime/")) throw new Error("workspace_path_outside_runtime");
  return normalized;
}

function buildContentPath(repo, path) {
  return `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export class WorkspaceChannel {
  constructor({ repo, branch } = {}) {
    this.repo = normalizeString(repo || getCurrentProjectRepository());
    this.branch = normalizeString(branch || getCurrentProjectBranch());
  }

  ensureReady() {
    if (!this.repo) throw new Error("workspace_repo_missing");
    if (!this.branch) throw new Error("workspace_branch_missing");
  }

  async readText(path) {
    this.ensureReady();
    const safePath = safeWorkspacePath(path);
    const result = await executeGitHubApiRequest({
      method: "GET",
      path: buildContentPath(this.repo, safePath),
      query: { ref: this.branch },
    });

    if (!result.ok) {
      throw new Error(`workspace_read_failed:${result.status}:${result.error || "unknown"}`);
    }

    return {
      path: safePath,
      sha: result.data?.sha || null,
      text: decodeBase64Utf8(result.data?.content || ""),
    };
  }

  async writeText(path, text, { message } = {}) {
    this.ensureReady();
    const safePath = safeWorkspacePath(path);
    let sha = null;

    try {
      const existing = await this.readText(safePath);
      sha = existing.sha || null;
    } catch {
      sha = null;
    }

    const result = await executeGitHubApiRequest({
      method: "PUT",
      path: buildContentPath(this.repo, safePath),
      body: {
        message: normalizeString(message) || `workspace: update ${safePath}`,
        branch: this.branch,
        content: encodeBase64Utf8(text),
        ...(sha ? { sha } : {}),
      },
    });

    if (!result.ok) {
      throw new Error(`workspace_write_failed:${result.status}:${result.error || "unknown"}`);
    }

    return {
      ok: true,
      repo: this.repo,
      branch: this.branch,
      path: safePath,
      commit: result.data?.commit?.sha || null,
    };
  }

  async writeJson(path, data, options = {}) {
    return this.writeText(path, `${JSON.stringify(data, null, 2)}\n`, options);
  }
}

export const workspaceChannel = new WorkspaceChannel();

export default workspaceChannel;
