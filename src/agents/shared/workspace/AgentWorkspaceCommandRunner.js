// AGENT NOTE:
// Agent workspace command runner skeleton.
// Purpose: validate and route parsed workspace commands and build write plans without performing I/O.
// This skeleton does not read GitHub, write GitHub, call Render API, call AI, or connect runtime.

import { parseAgentWorkspaceCommand } from "./AgentWorkspaceCommandParser.js";
import { buildAgentWorkspaceCleanupPlan } from "./AgentWorkspaceCleaner.js";
import { agentWorkspaceReportWriter } from "./AgentWorkspaceReportWriter.js";
import { renderAgentService } from "../../render-agent/index.js";

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

function buildFailedResult({ command, reason, reportWriter = agentWorkspaceReportWriter }) {
  const commandFailedWritePlan = command?.commandId && command.commandId !== "NONE"
    ? reportWriter.buildCommandStatusWritePlan({
        command,
        status: "FAILED",
        resultText: `Command failed before execution: ${reason}`,
      })
    : null;

  return {
    ok: false,
    skipped: false,
    reason,
    commandId: command?.commandId || "NONE",
    status: command?.status || "EMPTY",
    action: command?.action || "NONE",
    writes: false,
    renderReads: false,
    commandFailedWritePlan,
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

function buildResultText({ action, command, agentResult }) {
  return [
    `Action routed by skeleton: ${action}`,
    `Command ID: ${command.commandId || "NONE"}`,
    `Task ID: ${command.taskId || "manual"}`,
    `Workflow point: ${command.workflowPoint || "-"}`,
    `Agent: ${agentResult?.agent || "-"}`,
    `Agent mode: ${agentResult?.mode || "-"}`,
    `Render reads: ${agentResult?.renderReads === true ? "yes" : "no"}`,
    `GitHub writes: no`,
    `Summary: ${agentResult?.summary || "-"}`,
  ].join("\n");
}

export class AgentWorkspaceCommandRunner {
  constructor({
    renderAgent = renderAgentService,
    reportWriter = agentWorkspaceReportWriter,
  } = {}) {
    this.renderAgent = renderAgent;
    this.reportWriter = reportWriter;
  }

  async executeParsedCommand(command = {}) {
    if (!command.isAllowedStatus) {
      return buildFailedResult({
        command,
        reason: "workspace_command_status_not_allowed",
        reportWriter: this.reportWriter,
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
        reportWriter: this.reportWriter,
      });
    }

    if (!command.isAllowedAction) {
      return buildFailedResult({
        command,
        reason: "workspace_command_action_not_allowed",
        reportWriter: this.reportWriter,
      });
    }

    const input = buildPendingCommandInput(command);
    const cleanupPlan = buildAgentWorkspaceCleanupPlan({
      taskId: command.taskId,
      reason: "reset_before_command_run",
    });
    const cleanupWritePlans = this.reportWriter.buildCleanupWritePlans(cleanupPlan);
    const commandRunningWritePlan = this.reportWriter.buildCommandStatusWritePlan({
      command,
      status: "RUNNING",
      resultText: "Command accepted by AgentWorkspaceCommandRunner skeleton. Runtime I/O is not connected yet.",
    });

    let agentResult;

    if (command.action === "COLLECT_RENDER_ENV_STATUS") {
      agentResult = await this.renderAgent.collectEnvStatus(input);
    } else if (command.action === "COLLECT_RENDER_LOGS") {
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
        reportWriter: this.reportWriter,
      });
    }

    const finalStatus = agentResult?.ok === false ? "FAILED" : "DONE";
    const resultText = buildResultText({
      action: command.action,
      command,
      agentResult,
    });
    const commandFinalWritePlan = this.reportWriter.buildCommandStatusWritePlan({
      command,
      status: finalStatus,
      resultText,
    });

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
      cleanupWritePlans,
      commandRunningWritePlan,
      commandFinalWritePlan,
      agentResult,
      summary: "Workspace command runner skeleton validated command, routed it, and built write plans without runtime I/O.",
    };
  }

  async runMarkdown(markdown = "") {
    const command = parseAgentWorkspaceCommand(markdown);
    return this.executeParsedCommand(command);
  }
}

export const agentWorkspaceCommandRunner = new AgentWorkspaceCommandRunner();

export default AgentWorkspaceCommandRunner;
