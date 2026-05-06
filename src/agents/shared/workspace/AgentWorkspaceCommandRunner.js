// AGENT NOTE:
// Agent workspace command runner skeleton.
// Purpose: validate and route parsed workspace commands without performing I/O.
// This skeleton does not read GitHub, write GitHub, call Render API, call AI, or connect runtime.

import { parseAgentWorkspaceCommand } from "./AgentWorkspaceCommandParser.js";
import { buildAgentWorkspaceCleanupPlan } from "./AgentWorkspaceCleaner.js";
import { diagnosticsRenderAgentService } from "../../runtime-diagnostics/diagnostics-render-agent/DiagnosticsRenderAgentService.js";

function buildSkippedResult({ command, reason }) {
  return {
    ok: true,
    skipped: true,
    reason,
    commandId: command?.commandId || "NONE",
    status: command?.status || "EMPTY",
    action: command?.action || "NONE",
    writes: false,
    renderReads: false,
  };
}

function buildFailedResult({ command, reason }) {
  return {
    ok: false,
    skipped: false,
    reason,
    commandId: command?.commandId || "NONE",
    status: command?.status || "EMPTY",
    action: command?.action || "NONE",
    writes: false,
    renderReads: false,
  };
}

function buildPendingCommandInput(command = {}) {
  return {
    commandId: command.commandId,
    taskId: command.taskId,
    workflowPoint: command.workflowPoint,
    deployId: command.deployId,
    requiresCommit: command.requiresCommit,
    payload: command.payload,
  };
}

export class AgentWorkspaceCommandRunner {
  constructor({ renderAgent = diagnosticsRenderAgentService } = {}) {
    this.renderAgent = renderAgent;
  }

  async executeParsedCommand(command = {}) {
    if (!command.isAllowedStatus) {
      return buildFailedResult({
        command,
        reason: "workspace_command_status_not_allowed",
      });
    }

    if (!command.isPending) {
      return buildSkippedResult({
        command,
        reason: "workspace_command_not_pending",
      });
    }

    if (!command.commandId || command.commandId === "NONE") {
      return buildFailedResult({
        command,
        reason: "workspace_command_id_missing",
      });
    }

    if (!command.isAllowedAction) {
      return buildFailedResult({
        command,
        reason: "workspace_command_action_not_allowed",
      });
    }

    const input = buildPendingCommandInput(command);
    const cleanupPlan = buildAgentWorkspaceCleanupPlan({
      taskId: command.taskId,
      reason: "reset_before_command_run",
    });

    let agentResult;

    if (command.action === "COLLECT_RENDER_LOGS") {
      agentResult = await this.renderAgent.collectLogs(input);
    } else if (command.action === "COLLECT_RENDER_DEPLOYS") {
      agentResult = await this.renderAgent.collectDeploys(input);
    } else if (command.action === "COLLECT_RENDER_DEPLOY") {
      agentResult = await this.renderAgent.collectDeploy(input);
    } else if (command.action === "COLLECT_RENDER_STATUS") {
      agentResult = await this.renderAgent.collectStatus(input);
    } else {
      return buildFailedResult({
        command,
        reason: "workspace_command_action_not_supported_by_skeleton",
      });
    }

    return {
      ok: agentResult?.ok !== false,
      skipped: false,
      commandId: command.commandId,
      status: command.status,
      action: command.action,
      taskId: command.taskId,
      workflowPoint: command.workflowPoint,
      writes: false,
      renderReads: false,
      cleanupPlan,
      agentResult,
      summary: "Workspace command runner skeleton validated and routed command without runtime I/O.",
    };
  }

  async runMarkdown(markdown = "") {
    const command = parseAgentWorkspaceCommand(markdown);
    return this.executeParsedCommand(command);
  }
}

export const agentWorkspaceCommandRunner = new AgentWorkspaceCommandRunner();

export default AgentWorkspaceCommandRunner;
