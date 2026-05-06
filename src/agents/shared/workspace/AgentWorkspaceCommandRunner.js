// AGENT NOTE:
// Agent workspace command runner.
// Purpose: validate, route workspace commands, and write allowlisted workspace reports.
// Do not write source code, pillars, Telegram flow, AI, DB, or non-workspace files here.

import { parseAgentWorkspaceCommand } from "./AgentWorkspaceCommandParser.js";
import { buildAgentWorkspaceCleanupPlan } from "./AgentWorkspaceCleaner.js";
import { agentWorkspaceReportWriter } from "./AgentWorkspaceReportWriter.js";
import { renderAgentService } from "../../render-agent/index.js";

const RENDER_ACTION_REPORT_PATHS = Object.freeze({
  COLLECT_RENDER_ENV_STATUS: "agent_workspace/render/RENDER_ENV_STATUS_REPORT.md",
  COLLECT_RENDER_LOGS: "agent_workspace/render/RENDER_LOGS_REPORT.md",
  COLLECT_RENDER_DEPLOYS: "agent_workspace/render/RENDER_DEPLOYS_REPORT.md",
  COLLECT_RENDER_DEPLOY: "agent_workspace/render/RENDER_DEPLOY_REPORT.md",
  COLLECT_RENDER_STATUS: "agent_workspace/render/RENDER_STATUS_REPORT.md",
});

function nowIso() {
  return new Date().toISOString();
}

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
    `Action routed by workspace runner: ${action}`,
    `Command ID: ${command.commandId || "NONE"}`,
    `Task ID: ${command.taskId || "manual"}`,
    `Workflow point: ${command.workflowPoint || "-"}`,
    `Agent: ${agentResult?.agent || "-"}`,
    `Agent mode: ${agentResult?.mode || "-"}`,
    `Render reads: ${agentResult?.renderReads === true ? "yes" : "no"}`,
    `GitHub writes: allowlisted workspace files only`,
    `Summary: ${agentResult?.summary || "-"}`,
  ].join("\n");
}

function buildRenderReportMarkdown({ command, action, agentResult } = {}) {
  return `# ${action || "RENDER_REPORT"}\n\nRenderAgent workspace report.\n\n---\n\nState: \`${agentResult?.ok === false ? "FAILED" : "DONE"}\`\nCommand ID: \`${command?.commandId || "NONE"}\`\nTask ID: \`${command?.taskId || "manual"}\`\nAction: \`${action || "NONE"}\`\nUpdated at: \`${nowIso()}\`\n\n---\n\n## Summary\n\n${agentResult?.summary || "-"}\n\n---\n\n## Result\n\n\`\`\`json\n${JSON.stringify(agentResult || {}, null, 2)}\n\`\`\`\n`;
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
    const cleanupWriteResults = await this.reportWriter.applyWritePlans(cleanupWritePlans);
    const commandRunningWritePlan = this.reportWriter.buildCommandStatusWritePlan({
      command,
      status: "RUNNING",
      resultText: "Command accepted by AgentWorkspaceCommandRunner.",
    });
    const commandRunningWriteResult = await this.reportWriter.applyWritePlan(commandRunningWritePlan);

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
        reason: "workspace_command_action_not_supported_by_runner",
        reportWriter: this.reportWriter,
      });
    }

    const reportPath = RENDER_ACTION_REPORT_PATHS[command.action];
    const reportWritePlan = this.reportWriter.buildReportWritePlan({
      path: reportPath,
      content: buildRenderReportMarkdown({
        command,
        action: command.action,
        agentResult,
      }),
      message: `update workspace report ${reportPath}`,
    });
    const reportWriteResult = await this.reportWriter.applyWritePlan(reportWritePlan);

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
    const commandFinalWriteResult = await this.reportWriter.applyWritePlan(commandFinalWritePlan);

    return {
      ok: agentResult?.ok !== false,
      skipped: false,
      commandId: command.commandId,
      status: command.status,
      action: command.action,
      taskId: command.taskId,
      workflowPoint: command.workflowPoint,
      writes: true,
      renderReads: agentResult?.renderReads === true,
      cleanupPlan,
      cleanupWritePlans,
      cleanupWriteResults,
      commandRunningWritePlan,
      commandRunningWriteResult,
      reportWritePlan,
      reportWriteResult,
      commandFinalWritePlan,
      commandFinalWriteResult,
      agentResult,
      summary: "Workspace command runner executed the command and applied allowlisted workspace writes.",
    };
  }

  async runMarkdown(markdown = "") {
    const command = parseAgentWorkspaceCommand(markdown);
    return this.executeParsedCommand(command);
  }
}

export const agentWorkspaceCommandRunner = new AgentWorkspaceCommandRunner();

export default AgentWorkspaceCommandRunner;
