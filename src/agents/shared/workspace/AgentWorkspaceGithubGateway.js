// AGENT NOTE:
// Agent workspace GitHub gateway skeleton.
// Purpose: define a future adapter boundary between workspace reports and the existing SG GitHub tool gateway.
// This skeleton does not call GitHub, does not perform writes, and does not bypass approval policy.

import {
  AGENT_WORKSPACE_COMMAND_FILE,
  isCleanableWorkspaceReportPath,
} from "./AgentWorkspaceReportPaths.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildNotConnectedResult({ path, operation }) {
  return {
    ok: false,
    skipped: true,
    reason: "agent_workspace_github_gateway_not_connected",
    operation,
    path,
    writes: false,
  };
}

export class AgentWorkspaceGithubGateway {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled === true;
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
      path: normalizedPath,
      message: normalizedMessage,
      content: String(content || ""),
      writes: false,
      requiresApproval: true,
      gatewayConnected: this.enabled,
      reason: this.canWritePath(normalizedPath)
        ? "workspace_write_request_built"
        : "workspace_write_path_not_allowed",
    };
  }

  async writeFile({ path, content, message } = {}) {
    const request = this.buildWriteRequest({ path, content, message });

    if (!request.ok) {
      return request;
    }

    return buildNotConnectedResult({
      path: request.path,
      operation: request.operation,
    });
  }
}

export const agentWorkspaceGithubGateway = new AgentWorkspaceGithubGateway();

export default AgentWorkspaceGithubGateway;
