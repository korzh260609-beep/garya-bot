// src/agentWorkspace/AgentWorkspaceCommandRunner.js
// ============================================================================
// Event-driven command runner for agent_workspace/COMMANDS.md.
// It runs only allowlisted actions and updates only agent_workspace/*.md.
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import agentWorkspaceReportService from "./AgentWorkspaceReportService.js";
import { getAgentWorkspaceConfig } from "./AgentWorkspaceConfig.js";
import {
  parseAgentWorkspaceCommand,
  buildAgentWorkspaceCommandMarkdown,
} from "./AgentWorkspaceCommandParser.js";

let inMemoryRunLock = false;
const completedCommands = new Set();

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function emptyReport(title, taskId, reason = "reset_before_command_run") {
  return `# ${title}

Reset before current command run.

---

Task ID: \`${taskId || "-"}\`
Updated at: \`${nowIso()}\`
Reason: \`${reason}\`

---

-
`;
}

export class AgentWorkspaceCommandRunner {
  constructor({ config, client, reportService } = {}) {
    this.config = config || getAgentWorkspaceConfig();
    this.client = client || new AgentWorkspaceGitHubClient({ config: this.config });
    this.reportService = reportService || agentWorkspaceReportService;
  }

  isAllowedAction(action) {
    return this.config.allowedActions.includes(String(action || "").toUpperCase());
  }

  async readCommand() {
    const file = await this.client.readFile("COMMANDS.md");
    return {
      file,
      command: parseAgentWorkspaceCommand(file.content || ""),
    };
  }

  async markCommand(command, status, resultText) {
    return this.reportService.writeMarkdown(
      "COMMANDS.md",
      buildAgentWorkspaceCommandMarkdown(command, status, resultText),
      `mark command ${command.commandId || "NONE"} ${status}`
    );
  }

  async resetWorkspaceForCommand(command) {
    const taskId = command.taskId || "manual";
    const writes = [];

    writes.push(await this.reportService.writeMarkdown(
      "STATUS.md",
      emptyReport("STATUS", taskId),
      `reset status for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "LOOP_STATE.md",
      emptyReport("LOOP_STATE", taskId),
      `reset loop state for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "DEPLOY_REPORT.md",
      emptyReport("DEPLOY_REPORT", taskId),
      `reset deploy report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "RENDER_REPORT.md",
      emptyReport("RENDER_REPORT", taskId),
      `reset render report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "DIAGNOSIS.md",
      emptyReport("DIAGNOSIS", taskId, "reset_before_command_run_no_diagnosis_yet"),
      `reset diagnosis for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "TEST_REPORT.md",
      emptyReport("TEST_REPORT", taskId, "reset_before_command_run_no_test_yet"),
      `reset test report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "PATCH_REQUESTS.md",
      emptyReport("PATCH_REQUESTS", taskId, "reset_before_command_run_no_patch_requested"),
      `reset patch requests for ${taskId}`
    ));

    return writes;
  }

  buildRestForRenderReport(command) {
    return [
      command.taskId || "manual",
      command.workflowPoint || "-",
      command.deployId || "",
    ].filter(Boolean).join(" ");
  }

  buildRestForTestNote(command) {
    const body = normalizeString(command.payload) || "workspace command test note";
    return `${command.taskId || "manual"} ${body}`;
  }

  async executeCommand(command) {
    const action = String(command.action || "").toUpperCase();

    if (action === "VERIFY_DEPLOY" || action === "COLLECT_RENDER_REPORT") {
      return this.reportService.collectRenderReport(
        this.buildRestForRenderReport(command),
        "global"
      );
    }

    if (action === "WRITE_TEST_NOTE") {
      return this.reportService.writeTestNote(this.buildRestForTestNote(command));
    }

    throw new Error(`agent_workspace_action_not_supported:${action}`);
  }

  async runOnce({ source = "manual" } = {}) {
    if (inMemoryRunLock) {
      return {
        ok: false,
        skipped: true,
        reason: "agent_workspace_runner_locked",
      };
    }

    inMemoryRunLock = true;

    try {
      const { command } = await this.readCommand();
      const commandId = command.commandId || "NONE";
      const status = String(command.status || "").toUpperCase();
      const action = String(command.action || "").toUpperCase();

      if (status !== "PENDING") {
        return {
          ok: true,
          skipped: true,
          reason: "command_not_pending",
          commandId,
          status,
          action,
          source,
        };
      }

      if (!commandId || commandId === "NONE") {
        await this.markCommand(command, "FAILED", "Missing COMMAND_ID.");
        return {
          ok: false,
          commandId,
          action,
          reason: "missing_command_id",
        };
      }

      if (completedCommands.has(commandId)) {
        await this.markCommand(command, "IGNORED", "Command already completed in current runtime process.");
        return {
          ok: true,
          skipped: true,
          commandId,
          action,
          reason: "already_completed_in_process",
        };
      }

      if (!this.isAllowedAction(action)) {
        await this.markCommand(command, "FAILED", `Action is not allowed: ${action}`);
        return {
          ok: false,
          commandId,
          action,
          reason: "action_not_allowed",
        };
      }

      await this.markCommand(command, "RUNNING", `Started by ${source} at ${nowIso()}.`);
      await this.resetWorkspaceForCommand(command);

      const result = await this.executeCommand(command);
      completedCommands.add(commandId);

      await this.markCommand(
        command,
        "DONE",
        [
          `Action completed: ${action}`,
          `Task ID: ${command.taskId || "manual"}`,
          `Workflow point: ${command.workflowPoint || "-"}`,
          `Deploy ID: ${result?.deployId || command.deployId || "-"}`,
          `Commit: ${result?.commit || "-"}`,
          `Logs: ${Number(result?.logs || 0)}`,
          `Diagnosis: ${String(Boolean(result?.diagnosis))}`,
        ].join("\n")
      );

      return {
        ok: true,
        commandId,
        action,
        taskId: command.taskId,
        workflowPoint: command.workflowPoint,
        result,
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "unknown_error",
      };
    } finally {
      inMemoryRunLock = false;
    }
  }
}

export const agentWorkspaceCommandRunner = new AgentWorkspaceCommandRunner();

export default agentWorkspaceCommandRunner;
