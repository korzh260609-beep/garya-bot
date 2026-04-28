// src/agentWorkspace/AgentWorkspaceCommandRunner.js
// ============================================================================
// Event-driven command runner for agent_workspace/COMMANDS.md.
// It runs only allowlisted actions and updates only agent_workspace/*.md.
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import agentWorkspaceReportService from "./AgentWorkspaceReportService.js";
import agentWorkspaceRenderControlService from "./AgentWorkspaceRenderControlService.js";
import { getAgentWorkspaceConfig } from "./AgentWorkspaceConfig.js";
import {
  parseAgentWorkspaceCommand,
  buildAgentWorkspaceCommandMarkdown,
} from "./AgentWorkspaceCommandParser.js";
import { normalizeString } from "./AgentWorkspacePayloadParser.js";
import { nowIso } from "./AgentWorkspaceReportBuilders.js";
import {
  normalizeCommitSha,
  getRuntimeCommitSha,
  isCommitSatisfied,
} from "./AgentWorkspaceRuntimeGuard.js";
import {
  ensureGlobalRenderServiceSelected as selectGlobalRenderService,
} from "./AgentWorkspaceServiceSelector.js";
import { runWithAgentWorkspaceTimeout } from "./AgentWorkspaceCommandTimeout.js";
import { resetWorkspaceReportsForCommand } from "./AgentWorkspaceResetReports.js";
import {
  ensureDiagnosticBootstrapReady as ensureDiagnosticBootstrapReadyAction,
  executeDiagnosticCommand as executeDiagnosticCommandAction,
  runDiagnosticCommandsAction,
} from "./AgentWorkspaceDiagnosticExecutor.js";
import {
  runRepoStateScanAction,
  runRepoStateAgentAction,
} from "./AgentWorkspaceRepoStateActions.js";
import renderBridge from "../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../integrations/render/RenderBridgeStateStore.js";

let inMemoryRunLock = false;
const completedCommands = new Set();

export class AgentWorkspaceCommandRunner {
  constructor({ config, client, reportService, renderControlService } = {}) {
    this.config = config || getAgentWorkspaceConfig();
    this.client = client || new AgentWorkspaceGitHubClient({ config: this.config });
    this.reportService = reportService || agentWorkspaceReportService;
    this.renderControlService = renderControlService || agentWorkspaceRenderControlService;
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
    return resetWorkspaceReportsForCommand({
      command,
      reportService: this.reportService,
    });
  }

  async ensureDiagnosticBootstrapReady(command) {
    return ensureDiagnosticBootstrapReadyAction({
      command,
      config: this.config,
    });
  }

  async ensureGlobalRenderServiceSelected() {
    return selectGlobalRenderService({
      renderBridge,
      renderBridgeStateStore,
    });
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

  async executeDiagnosticCommand(commandName) {
    return executeDiagnosticCommandAction({
      commandName,
      config: this.config,
      reportService: this.reportService,
      ensureGlobalRenderServiceSelected: () => this.ensureGlobalRenderServiceSelected(),
    });
  }

  async runDiagnosticCommands(command) {
    return runDiagnosticCommandsAction({
      command,
      config: this.config,
      reportService: this.reportService,
      ensureGlobalRenderServiceSelected: () => this.ensureGlobalRenderServiceSelected(),
    });
  }

  async runRepoStateScan(command) {
    return runRepoStateScanAction({
      command,
      reportService: this.reportService,
    });
  }

  async runRepoStateAgent(command) {
    return runRepoStateAgentAction({
      command,
      reportService: this.reportService,
    });
  }

  async executeCommand(command) {
    const action = String(command.action || "").toUpperCase();

    if (action === "VERIFY_DEPLOY" || action === "COLLECT_RENDER_REPORT") {
      await this.ensureGlobalRenderServiceSelected();
      return this.reportService.collectRenderReport(
        this.buildRestForRenderReport(command),
        "global"
      );
    }

    if (action === "COLLECT_RENDER_LOGS") {
      return this.renderControlService.collectLogs(command);
    }

    if (action === "COLLECT_RENDER_DEPLOYS") {
      return this.renderControlService.collectDeploys(command);
    }

    if (action === "COLLECT_RENDER_DEPLOY") {
      return this.renderControlService.collectDeploy(command);
    }

    if (action === "COLLECT_RENDER_STATUS") {
      return this.renderControlService.collectStatus(command);
    }

    if (action === "WRITE_TEST_NOTE") {
      return this.reportService.writeTestNote(this.buildRestForTestNote(command));
    }

    if (action === "RUN_DIAGNOSTIC_COMMANDS") {
      return this.runDiagnosticCommands(command);
    }

    if (action === "RUN_REPO_STATE_SCAN") {
      return this.runRepoStateScan(command);
    }

    if (action === "RUN_REPO_STATE_AGENT") {
      return this.runRepoStateAgent(command);
    }

    throw new Error(`agent_workspace_action_not_supported:${action}`);
  }

  async runOnce({ source = "manual" } = {}) {
    let activeCommand = null;

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
      activeCommand = command;
      const commandId = command.commandId || "NONE";
      const status = String(command.status || "").toUpperCase();
      const action = String(command.action || "").toUpperCase();
      const requiredCommit = normalizeCommitSha(command.requiresCommit || "");
      const runtimeCommit = getRuntimeCommitSha();

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

      const commitSatisfied = await isCommitSatisfied({
        runtimeCommit,
        requiredCommit,
        client: this.client,
      });

      if (requiredCommit && !commitSatisfied) {
        return {
          ok: true,
          skipped: true,
          reason: "required_commit_not_active_yet",
          commandId,
          status,
          action,
          source,
          requiredCommit,
          runtimeCommit: runtimeCommit || null,
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

      const bootstrapGate = await this.ensureDiagnosticBootstrapReady(command);
      if (!bootstrapGate.ok) {
        await this.markCommand(command, "FAILED", bootstrapGate.resultText || "AgentWorkspace diagnostic bootstrap safety gate failed.");
        return {
          ok: false,
          commandId,
          action,
          reason: "diagnostic_bootstrap_safety_gate_failed",
          bootstrapGate,
        };
      }

      await this.markCommand(command, "RUNNING", `Started by ${source} at ${nowIso()}.`);
      await this.resetWorkspaceForCommand(command);

      const result = await runWithAgentWorkspaceTimeout(
        this.executeCommand(command),
        {
          label: `agent_workspace_command_${action.toLowerCase()}`,
        }
      );
      completedCommands.add(commandId);

      await this.markCommand(
        command,
        result?.ok === false ? "FAILED" : "DONE",
        [
          `Action completed: ${action}`,
          `Task ID: ${command.taskId || "manual"}`,
          `Workflow point: ${command.workflowPoint || "-"}`,
          `Deploy ID: ${result?.deployId || command.deployId || "-"}`,
          `Commit: ${result?.commit || result?.latestCommit || runtimeCommit || "-"}`,
          `Required commit: ${requiredCommit || "-"}`,
          `Runtime commit: ${runtimeCommit || "-"}`,
          `Logs: ${Number(result?.logs || 0)}`,
          `Diagnosis: ${String(Boolean(result?.diagnosis))}`,
          `Diagnostic commands: ${Number(result?.diagnosticCommands || 0)}`,
          `Diagnostics OK: ${Number(result?.diagnosticsOk || 0)}`,
          `Diagnostics failed: ${Number(result?.diagnosticsFailed || 0)}`,
        ].join("\n")
      );

      return {
        ok: result?.ok !== false,
        commandId,
        action,
        taskId: command.taskId,
        workflowPoint: command.workflowPoint,
        requiredCommit,
        runtimeCommit,
        result,
      };
    } catch (error) {
      if (activeCommand?.commandId && activeCommand.commandId !== "NONE") {
        try {
          await this.markCommand(
            activeCommand,
            "FAILED",
            `Runner failed: ${error?.message || "unknown_error"}`
          );
        } catch (markError) {
          console.error("AgentWorkspace failed to mark command FAILED:", markError);
        }
      }

      return {
        ok: false,
        commandId: activeCommand?.commandId || null,
        action: activeCommand?.action || null,
        error: error?.message || "unknown_error",
      };
    } finally {
      inMemoryRunLock = false;
    }
  }
}

export const agentWorkspaceCommandRunner = new AgentWorkspaceCommandRunner();

export default agentWorkspaceCommandRunner;
