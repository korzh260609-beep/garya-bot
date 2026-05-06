// AGENT NOTE:
// Agent workspace report writer.
// Purpose: build and apply controlled writes for workspace reports and command status updates.
// Only allowlisted workspace files may be written through the gateway.

import { agentWorkspaceGithubGateway } from "./AgentWorkspaceGithubGateway.js";
import {
  AGENT_WORKSPACE_COMMAND_FILE,
  isCleanableWorkspaceReportPath,
} from "./AgentWorkspaceReportPaths.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function buildAllowedStatusesMarkdown() {
  return ["EMPTY", "PENDING", "RUNNING", "DONE", "FAILED", "IGNORED"]
    .map((status) => `- \`${status}\``)
    .join("\n");
}

function buildAllowedActionsMarkdown() {
  return [
    "COLLECT_RENDER_ENV_STATUS",
    "COLLECT_RENDER_LOGS",
    "COLLECT_RENDER_DEPLOYS",
    "COLLECT_RENDER_DEPLOY",
    "COLLECT_RENDER_STATUS",
  ].map((action) => `- \`${action}\``).join("\n");
}

export function buildAgentWorkspaceCommandMarkdown(command = {}, status = "EMPTY", resultText = "") {
  const nextStatus = normalizeString(status) || normalizeString(command.status) || "EMPTY";

  return `# COMMANDS\n\nCurrent event-driven command for SG workspace runner.\n\nOnly one active command is allowed at a time.\n\n---\n\nCOMMAND_ID: \`${command.commandId || "NONE"}\`\nSTATUS: \`${nextStatus}\`\nACTION: \`${command.action || "NONE"}\`\nTASK_ID: \`${command.taskId || "manual"}\`\nWORKFLOW_POINT: \`${command.workflowPoint || "-"}\`\nDEPLOY_ID: \`${command.deployId || "-"}\`\nREQUIRES_COMMIT: \`${command.requiresCommit || "-"}\`\nCREATED_BY: \`${command.createdBy || "-"}\`\nCREATED_AT: \`${command.createdAt || "-"}\`\nUPDATED_AT: \`${nowIso()}\`\n\n---\n\n## Payload\n\n${command.payload || "-"}\n\n---\n\n## Last result\n\n${resultText || "-"}\n\n---\n\n## Allowed statuses\n\n${buildAllowedStatusesMarkdown()}\n\n## Allowed actions\n\n${buildAllowedActionsMarkdown()}\n\n## Hard limits\n\n- SG must run only \`STATUS: PENDING\` commands.\n- SG must ignore already completed commands.\n- SG must not write code or pillars from this command file.\n- SG must update only allowlisted files in \`agent_workspace/\`.\n- \`COMMANDS.md\` must not be auto-cleared by the workspace cleaner.\n- If \`REQUIRES_COMMIT\` is set, SG must skip execution until runtime commit matches it.\n`;
}

export class AgentWorkspaceReportWriter {
  constructor({ gateway = agentWorkspaceGithubGateway } = {}) {
    this.gateway = gateway;
  }

  buildReportWritePlan({ path, content, message } = {}) {
    const normalizedPath = normalizeString(path);

    if (!isCleanableWorkspaceReportPath(normalizedPath)) {
      return {
        ok: false,
        path: normalizedPath,
        reason: "workspace_report_path_not_allowed",
        writes: false,
      };
    }

    return this.gateway.buildWriteRequest({
      path: normalizedPath,
      content,
      message: normalizeString(message) || `update workspace report ${normalizedPath}`,
    });
  }

  buildCommandStatusWritePlan({ command = {}, status = "EMPTY", resultText = "" } = {}) {
    return this.gateway.buildWriteRequest({
      path: AGENT_WORKSPACE_COMMAND_FILE,
      content: buildAgentWorkspaceCommandMarkdown(command, status, resultText),
      message: `mark workspace command ${command.commandId || "NONE"} ${status}`,
    });
  }

  buildCleanupWritePlans(cleanupPlan = []) {
    return cleanupPlan.map((item) => this.buildReportWritePlan({
      path: item.path,
      content: item.content,
      message: `reset workspace report ${item.path}`,
    }));
  }

  async applyWritePlan(writePlan = {}) {
    if (!writePlan?.ok) {
      return {
        ok: false,
        skipped: true,
        reason: writePlan?.reason || "workspace_write_plan_not_ok",
        path: writePlan?.path || "",
        writes: false,
      };
    }

    return this.gateway.writeFile({
      path: writePlan.path,
      content: writePlan.content,
      message: writePlan.message,
    });
  }

  async applyWritePlans(writePlans = []) {
    const results = [];

    for (const writePlan of writePlans) {
      results.push(await this.applyWritePlan(writePlan));
    }

    return results;
  }
}

export const agentWorkspaceReportWriter = new AgentWorkspaceReportWriter();

export default AgentWorkspaceReportWriter;
