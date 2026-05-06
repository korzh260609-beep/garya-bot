// AGENT NOTE:
// Agent workspace command reader skeleton.
// Purpose: read the workspace command handoff file through the existing GitHub read gateway.
// Do not write GitHub, call Render, call AI, call DB, modify Telegram flow, or execute commands here.

import { executeGitHubApiRequest } from "../../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../../tools/github/githubProjectDefaults.js";
import { parseAgentWorkspaceCommand } from "./AgentWorkspaceCommandParser.js";
import { AGENT_WORKSPACE_COMMAND_FILE } from "./AgentWorkspaceReportPaths.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeBase64Utf8(value) {
  const text = normalizeString(value).replace(/\s+/g, "");
  if (!text) return "";

  return Buffer.from(text, "base64").toString("utf-8");
}

function buildSkippedResult({ reason, repository, branch, path } = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    repository,
    branch,
    path,
    githubReads: false,
    githubWrites: false,
    commandExecution: false,
  };
}

export class AgentWorkspaceCommandReader {
  constructor({
    repository = getCurrentProjectRepository(),
    branch = getCurrentProjectBranch(),
    commandPath = AGENT_WORKSPACE_COMMAND_FILE,
    githubRequest = executeGitHubApiRequest,
  } = {}) {
    this.repository = normalizeString(repository);
    this.branch = normalizeString(branch);
    this.commandPath = normalizeString(commandPath);
    this.githubRequest = githubRequest;
  }

  async readCommandMarkdown() {
    if (!this.repository) {
      return buildSkippedResult({
        reason: "workspace_command_reader_repository_missing",
        repository: this.repository,
        branch: this.branch,
        path: this.commandPath,
      });
    }

    if (!this.branch) {
      return buildSkippedResult({
        reason: "workspace_command_reader_branch_missing",
        repository: this.repository,
        branch: this.branch,
        path: this.commandPath,
      });
    }

    if (!this.commandPath) {
      return buildSkippedResult({
        reason: "workspace_command_reader_path_missing",
        repository: this.repository,
        branch: this.branch,
        path: this.commandPath,
      });
    }

    const result = await this.githubRequest({
      method: "GET",
      path: `/repos/${this.repository}/contents/${this.commandPath}`,
      query: { ref: this.branch },
    });

    if (!result?.ok) {
      return {
        ok: false,
        skipped: false,
        reason: "workspace_command_reader_github_read_failed",
        repository: this.repository,
        branch: this.branch,
        path: this.commandPath,
        status: result?.status || 0,
        error: normalizeString(result?.error),
        githubReads: true,
        githubWrites: false,
        commandExecution: false,
      };
    }

    const markdown = decodeBase64Utf8(result?.data?.content || "");

    return {
      ok: true,
      skipped: false,
      reason: "ok",
      repository: this.repository,
      branch: this.branch,
      path: this.commandPath,
      sha: result?.data?.sha || "",
      markdown,
      githubReads: true,
      githubWrites: false,
      commandExecution: false,
    };
  }

  async readParsedCommand() {
    const result = await this.readCommandMarkdown();

    if (!result.ok) {
      return {
        ...result,
        command: null,
      };
    }

    return {
      ...result,
      command: parseAgentWorkspaceCommand(result.markdown),
    };
  }
}

export const agentWorkspaceCommandReader = new AgentWorkspaceCommandReader();

export default AgentWorkspaceCommandReader;
