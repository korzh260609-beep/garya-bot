// src/agentWorkspace/AgentWorkspaceCommandRunner.js
// ============================================================================
// Event-driven command runner for agent_workspace/COMMANDS.md.
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import agentWorkspaceReportService from "./AgentWorkspaceReportService.js";
import agentWorkspaceRenderControlService from "./AgentWorkspaceRenderControlService.js";
import {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
  isAgentWorkspaceReadOnlyDiagnosticCommand,
} from "./AgentWorkspaceConfig.js";
import { createRepoStateCollector } from "../repoStateCollector/RepoStateCollectorFactory.js";

// (сокращено: остальной код без изменений)

  async runRepoStateScan(command) {
    const { collector } = createRepoStateCollector();
    const snapshot = await collector.runScan();

    await this.reportService.writeMarkdown(
      "TEST_REPORT.md",
      JSON.stringify(snapshot, null, 2),
      `repo state scan ${command.taskId || "manual"}`
    );

    return {
      ok: snapshot?.ok === true && snapshot?.persisted === true,
      result: snapshot,
    };
  }

  async executeCommand(command) {
    const action = String(command.action || "").toUpperCase();

    if (action === "RUN_DIAGNOSTIC_COMMANDS") {
      return this.runDiagnosticCommands(command);
    }

    if (action === "RUN_REPO_STATE_SCAN") {
      return this.runRepoStateScan(command);
    }

    throw new Error(`agent_workspace_action_not_supported:${action}`);
  }
