// AGENT NOTE:
// Agent workspace GitHub gateway.
// Purpose: write only allowlisted workspace reports and the workspace command file.
// Do not bypass workspace path allowlists. Do not write source code, pillars, secrets, or non-workspace files.

import { executeGitHubApiRequest } from "../../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../../tools/github/githubProjectDefaults.js";
import {
  AGENT_WORKSPACE_COMMAND_FILE,
  isCleanableWorkspaceReportPath,
} from "./AgentWorkspaceReportPaths.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function encodeBase64Utf8(value) {
  return Buffer.from(String(value || ""), "utf-8").toString("base64");
}

function isEnabledFromEnv() {
  const raw = normalizeString(process.env.AGENT_WORKSPACE_GITHUB_WRITE_ENABLED || "").toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function buildNotConnectedResult({ path, operation }) {
  return {
    ok: false,
    skipped: true,
    reason: "agent_workspace_github_gateway_not_enabled",
    operation,
    path,
    writes: false,
  };
}

export class AgentWorkspaceGithubGateway {
  constructor({
    enabled = isEnabledFromEnv(),
    repository = getCurrentProjectRepository(),
    branch = getCurrentProjectBranch(),
    githubRequest = executeGitHubApiRequest,
  } = {}) {
    this.enabled = enabled === true;
    this.repository = normalizeString(repository);
    this.branch = normalizeString(branch);
    this.githubRequest = githubRequest;
  }

  canWritePath(path) {
    const normalizedPath = normalizeString(path);
    return normalizedPath === AGENT_WORKSPACE_COMMAND_FILE || isCleanableWorkspaceReportPath(normalizedPath);
  }

  buildWriteRequest({ path, content, message } = {}) {
    const normalizedPath = normalizeString(path);
    const normalizedMessage = normalizeString(message) || `update ${normalizedPath}`;

    return {
      ok: Boolean(normalizedPath) && this.canWritePath(normalizedPath),
      operation: "workspace_github_write_request",
      repository: this.repository,
      branch: this.branch,
      path: normalizedPath,
      message: normalizedMessage,
      content: String(content || ""),
      writes: false,
      requiresApproval: false,
      gatewayConnected: this.enabled,
      reason: this.canWritePath(normalizedPath)
        ? "workspace_write_request_built"
        : "workspace_write_path_not_allowed",
    };
  }

  async getCurrentFileSha(path) {
    const result = await this.githubRequest({
      method: "GET",
      path: `/repos/${this.repository}/contents/${path}`,
      query: { ref: this.branch },
    });

    if (!result?.ok) return "";
    return normalizeString(result?.data?.sha);
  }

  async writeFile({ path, content, message } = {}) {
    const request = this.buildWriteRequest({ path, content, message });

    if (!request.ok) {
      return request;
    }

    if (!this.enabled) {
      return buildNotConnectedResult({
        path: request.path,
        operation: request.operation,
      });
    }

    if (!this.repository || !this.branch) {
      return {
        ok: false,
        skipped: true,
        reason: "workspace_github_gateway_project_target_missing",
        operation: request.operation,
        path: request.path,
        writes: false,
      };
    }

    const sha = await this.getCurrentFileSha(request.path);
    const result = await this.githubRequest({
      method: "PUT",
      path: `/repos/${this.repository}/contents/${request.path}`,
      body: {
        message: request.message,
        content: encodeBase64Utf8(request.content),
        branch: this.branch,
        ...(sha ? { sha } : {}),
      },
    });

    return {
      ok: result?.ok === true,
      skipped: false,
      reason: result?.ok ? "workspace_github_write_done" : "workspace_github_write_failed",
      operation: request.operation,
      repository: this.repository,
      branch: this.branch,
      path: request.path,
      status: result?.status || 0,
      error: normalizeString(result?.error),
      writes: result?.ok === true,
    };
  }
}

export const agentWorkspaceGithubGateway = new AgentWorkspaceGithubGateway();

export default AgentWorkspaceGithubGateway;
