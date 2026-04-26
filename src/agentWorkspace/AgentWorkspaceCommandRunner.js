// src/agentWorkspace/AgentWorkspaceCommandRunner.js
// ============================================================================
// Event-driven command runner for agent_workspace/COMMANDS.md.
// It runs only allowlisted actions and updates only agent_workspace/*.md.
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import agentWorkspaceReportService from "./AgentWorkspaceReportService.js";
import agentWorkspaceRenderControlService from "./AgentWorkspaceRenderControlService.js";
import {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
} from "./AgentWorkspaceConfig.js";
import {
  parseAgentWorkspaceCommand,
  buildAgentWorkspaceCommandMarkdown,
} from "./AgentWorkspaceCommandParser.js";
import { executeAgentWorkspaceChatCommand } from "./AgentWorkspaceChatCommandExecutor.js";
import renderBridge from "../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../integrations/render/RenderBridgeStateStore.js";
import { getRenderBridgeConfig } from "../integrations/render/RenderBridgeConfig.js";

let inMemoryRunLock = false;
const completedCommands = new Set();

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value, max = 4000) {
  let text = "";
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value || "");
  }

  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
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

function serviceMatchesGaryaBot(service = {}) {
  const name = String(service?.name || "").toLowerCase();
  const slug = String(service?.slug || "").toLowerCase();
  return name === "garya-bot" || slug === "garya-bot";
}

function parseDiagnosticCommandLines(payload = "") {
  const lines = String(payload || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("/"));

  return Array.from(new Set(lines.map((line) => line.split(/\s+/)[0])));
}

function buildDiagnosticTestReport({ command, results, collectedAt }) {
  const executed = results.map((item) => `${item.command}: ${item.ok ? "OK" : "FAILED"}`).join("\n") || "-";
  const chatOutput = results.map((item) => {
    return [
      `## ${item.command}`,
      item.outputText || "-",
    ].join("\n");
  }).join("\n\n");
  const raw = results.map((item) => {
    return [
      `## ${item.command}`,
      `ok=${String(item.ok)}`,
      item.handler ? `handler=${item.handler}` : "handler=-",
      item.error ? `error=${item.error}` : "error=-",
      "```json",
      safeJson(item.data || item.output || item.messages || {}, 6000),
      "```",
    ].join("\n");
  }).join("\n\n");

  return `# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: \`${command.taskId || "manual"}\`
Deploy ID: \`${command.deployId || "-"}\`
Commit: \`-\`
Tested at: \`${collectedAt}\`
Tested by: \`SG AgentWorkspaceCommandRunner\`

---

## Test commands

\`\`\`text
${parseDiagnosticCommandLines(command.payload).join("\n") || "-"}
\`\`\`

## Expected answers

The runner must execute allowlisted SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

\`\`\`text
${executed}
\`\`\`

## Chat response logs

\`\`\`text
${chatOutput || "-"}
\`\`\`

## Render logs during test

\`\`\`text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
\`\`\`

## Result

- \`${results.every((item) => item.ok) ? "DIAGNOSTICS_OK" : "DIAGNOSTICS_FAILED"}\`

## Notes

${raw || "-"}
`;
}

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

  isAllowedDiagnosticCommand(command) {
    return this.config.allowedDiagnosticCommands.includes(String(command || ""));
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
      "RENDER_LOGS_REPORT.md",
      emptyReport("RENDER_LOGS_REPORT", taskId),
      `reset render logs report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "RENDER_DEPLOYS_REPORT.md",
      emptyReport("RENDER_DEPLOYS_REPORT", taskId),
      `reset render deploys report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "RENDER_DEPLOY_REPORT.md",
      emptyReport("RENDER_DEPLOY_REPORT", taskId),
      `reset render deploy report for ${taskId}`
    ));

    writes.push(await this.reportService.writeMarkdown(
      "RENDER_STATUS_REPORT.md",
      emptyReport("RENDER_STATUS_REPORT", taskId),
      `reset render status report for ${taskId}`
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

  async ensureGlobalRenderServiceSelected() {
    const current = await renderBridgeStateStore.getState("global");
    if (current?.selected_service_id) {
      return current;
    }

    const services = await renderBridge.listServices();
    const selected = services.find(serviceMatchesGaryaBot) || (services.length === 1 ? services[0] : null);

    if (!selected?.id) {
      throw new Error("agent_workspace_no_render_service_available_for_global_runner");
    }

    return renderBridgeStateStore.setSelectedService({
      ownerKey: "global",
      serviceId: selected.id,
      serviceName: selected.name || selected.slug || "garya-bot",
      serviceSlug: selected.slug || selected.name || "garya-bot",
      ownerId: selected.ownerId || selected.owner?.id || selected.owner_id || null,
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
    if (!this.isAllowedDiagnosticCommand(commandName)) {
      return {
        command: commandName,
        ok: false,
        error: "diagnostic_command_not_allowed",
      };
    }

    try {
      if (
        commandName === "/pm_capabilities_diag" ||
        commandName === "/memory_remember_guard_diag" ||
        commandName === "/memory_long_term_read_diag" ||
        commandName === "/memory_confirmed_restore_diag" ||
        commandName === "/memory_archive_write_diag"
      ) {
        return executeAgentWorkspaceChatCommand(commandName);
      }

      if (commandName === "/agent_workspace_diag") {
        return { command: commandName, ok: true, data: getAgentWorkspaceDiag() };
      }

      if (commandName === "/render_bridge_diag") {
        return { command: commandName, ok: true, data: renderBridge.getDiag() };
      }

      if (commandName === "/render_bridge_services") {
        return {
          command: commandName,
          ok: true,
          data: await renderBridge.listServices(),
        };
      }

      if (commandName === "/render_bridge_deploys") {
        const state = await this.ensureGlobalRenderServiceSelected();
        return {
          command: commandName,
          ok: true,
          data: await renderBridge.listDeploys({
            serviceId: state.selected_service_id,
            limit: getRenderBridgeConfig().defaultDeployLimit,
          }),
        };
      }

      if (commandName === "/render_bridge_logs") {
        const state = await this.ensureGlobalRenderServiceSelected();
        const cfg = getRenderBridgeConfig();
        return {
          command: commandName,
          ok: true,
          data: await renderBridge.listRecentLogs({
            ownerId: state.selected_owner_id,
            serviceId: state.selected_service_id,
            level: cfg.defaultLogLevel,
            minutes: cfg.defaultLogWindowMinutes,
            limit: cfg.defaultLogLimit,
          }),
        };
      }

      if (commandName === "/render_bridge_diagnose") {
        await this.ensureGlobalRenderServiceSelected();
        const result = await this.reportService.collectRenderReport("diagnostic render-bridge-diagnose", "global");
        return {
          command: commandName,
          ok: true,
          data: result,
        };
      }

      return {
        command: commandName,
        ok: false,
        error: "diagnostic_command_not_implemented",
      };
    } catch (error) {
      return {
        command: commandName,
        ok: false,
        error: error?.message || "unknown_error",
      };
    }
  }

  async runDiagnosticCommands(command) {
    const requested = parseDiagnosticCommandLines(command.payload);

    if (!requested.length) {
      throw new Error("agent_workspace_no_diagnostic_commands_in_payload");
    }

    const results = [];
    for (const cmd of requested) {
      results.push(await this.executeDiagnosticCommand(cmd));
    }

    const collectedAt = nowIso();
    await this.reportService.writeMarkdown(
      "TEST_REPORT.md",
      buildDiagnosticTestReport({ command, results, collectedAt }),
      `write diagnostic command results for ${command.taskId || "manual"}`
    );

    return {
      ok: results.every((item) => item.ok),
      taskId: command.taskId || "manual",
      workflowPoint: command.workflowPoint || "-",
      diagnosticCommands: results.length,
      diagnosticsOk: results.filter((item) => item.ok).length,
      diagnosticsFailed: results.filter((item) => !item.ok).length,
      results,
    };
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
        result?.ok === false ? "FAILED" : "DONE",
        [
          `Action completed: ${action}`,
          `Task ID: ${command.taskId || "manual"}`,
          `Workflow point: ${command.workflowPoint || "-"}`,
          `Deploy ID: ${result?.deployId || command.deployId || "-"}`,
          `Commit: ${result?.commit || result?.latestCommit || "-"}`,
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
