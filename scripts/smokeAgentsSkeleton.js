// AGENT NOTE:
// Smoke test for SG 2.0 agent skeletons.
// Purpose: verify repo/workspace/render collector skeletons import and remain safe.
// This script must not call Telegram, Render, GitHub, DB, OpenAI, or external services.

import assert from "node:assert/strict";
import { RepoStateAgentService } from "../src/agents/repo-intelligence/repo-state-agent/index.js";
import { RepoMaintenanceAgentService } from "../src/agents/repo-maintenance/repo-maintenance-agent/index.js";
import { RenderLogsCollectorService } from "../src/agents/runtime-collector/render-logs-collector/index.js";
import { getLatestWorkspaceResult } from "../src/agents/shared/workspace/WorkspaceResultStore.js";
import { WorkspaceReader } from "../src/agents/shared/workspace/WorkspaceReader.js";
import { WorkspaceWriter } from "../src/agents/shared/workspace/WorkspaceWriter.js";
import {
  getWorkspaceReportTypeForAction,
  WORKSPACE_COMMAND_ACTIONS,
  WORKSPACE_REPORT_TYPES,
} from "../src/agents/shared/workspace/WorkspaceReportTypes.js";
import { AgentRegistryService } from "../src/agents/shared/registry/AgentRegistryService.js";

function assertSafeAgentResult(result, agentName) {
  assert.equal(result.ok, true, `${agentName} should return ok=true`);
  assert.equal(result.agent, agentName, `${agentName} should identify itself`);
  assert.equal(result.canChangeState, false, `${agentName} must not be state-changing`);
  assert.equal(result.tokensSpent, false, `${agentName} must not spend tokens`);
  assert.equal(typeof result.data, "object", `${agentName} should return data object`);
}

function runRepoStateAgentSmoke() {
  const service = new RepoStateAgentService();
  const result = service.analyze({
    repoFullName: "korzh260609-beep/garya-bot",
    branch: "dev/v2-start",
    files: [
      "index.js",
      "package.json",
      ".env.example",
      "src/core/handleMessage.js",
      "src/transport/telegram.js",
      "src/agents/repo-intelligence/repo-state-agent/index.js",
      "pillars/workflow/03_minimal_speaking_sg.md",
    ],
    dependencies: [],
  });

  assertSafeAgentResult(result, "repo-state-agent");
  assert.equal(result.data.projectMap.tokensSpent, false, "projectMap must not spend tokens");
  assert.equal(result.data.projectMap.canChangeState, false, "projectMap must not change state");
  assert.ok(result.data.projectMap.layers.core, "projectMap should detect core layer");
  assert.ok(result.data.projectMap.layers.pillars, "projectMap should detect pillars layer");
  assert.equal(result.data.architectureHealth.tokensSpent, false, "architectureHealth must not spend tokens");
  assert.equal(result.data.nextActionPlan.tokensSpent, false, "nextActionPlan must not spend tokens");
}

function runRepoMaintenanceAgentSmoke() {
  const service = new RepoMaintenanceAgentService();
  const result = service.analyze({
    changedFiles: [
      "src/core/handleMessage.js",
      "src/agents/runtime-collector/render-logs-collector/index.js",
      "agent_workspace/COMMANDS.md",
    ],
  });

  assertSafeAgentResult(result, "repo-maintenance-agent");
  assert.equal(result.data.report.tokensSpent, false, "maintenance report must not spend tokens");
  assert.equal(result.data.report.canChangeState, false, "maintenance report must not change state");
  assert.ok(result.data.report.impactedAreas.includes("core"), "maintenance report should detect core impact");
}

function runRenderLogsCollectorSmoke() {
  const service = new RenderLogsCollectorService();
  const result = service.buildWorkspaceReport({
    type: "render_logs",
    data: {
      logs: [
        { timestamp: "2026-05-04T00:00:00.000Z", level: "info", message: "service started" },
        { timestamp: "2026-05-04T00:01:00.000Z", level: "info", message: "service live" },
      ],
    },
    metadata: {
      target: "latest_count",
      limit: 2,
      collectedAt: "2026-05-04T00:02:00.000Z",
    },
  });

  assertSafeAgentResult(result, "render-logs-collector");
  assert.equal(result.data.fileName, "RENDER_LOGS_REPORT.md", "collector should target logs report file");
  assert.equal(result.data.workspacePath, "agent_workspace/RENDER_LOGS_REPORT.md", "collector should use allowlisted workspace path");
  assert.match(result.data.content, /Analysis: `none`/, "collector report must state no analysis");
  assert.match(result.data.content, /Returned: `2`/, "collector report should include returned count");

  const latest = getLatestWorkspaceResult();
  assert.equal(latest.type, "render_logs", "latest workspace result should be render_logs");
  assert.equal(latest.workspacePath, "agent_workspace/RENDER_LOGS_REPORT.md", "latest workspace result should point to report");
}

function runWorkspaceIoSmoke() {
  const reader = new WorkspaceReader();
  const commandContent = `# COMMANDS\n\nCOMMAND_ID: smoke-001\nSTATUS: READY\nACTION: COLLECT_RENDER_LOGS\nLIMIT: 5\nTARGET: latest_count\n`;

  const readResult = reader.readProvidedFile({
    fileName: "COMMANDS.md",
    content: commandContent,
  });

  assert.equal(readResult.ok, true, "workspace reader should read provided content");
  assert.equal(readResult.canChangeState, false, "workspace reader must not change state");
  assert.equal(readResult.tokensSpent, false, "workspace reader must not spend tokens");
  assert.equal(readResult.metadata.readsFilesystem, false, "workspace reader must not read filesystem in skeleton");

  const parsedResult = reader.parseProvidedCommand({ content: commandContent });

  assert.equal(parsedResult.ok, true, "workspace command parser should accept allowed action");
  assert.equal(parsedResult.canChangeState, false, "workspace command parser must not change state");
  assert.equal(parsedResult.tokensSpent, false, "workspace command parser must not spend tokens");
  assert.equal(parsedResult.command.action, WORKSPACE_COMMAND_ACTIONS.collectRenderLogs, "parser should read action");
  assert.equal(parsedResult.command.reportType, WORKSPACE_REPORT_TYPES.renderLogs, "parser should map action to report type");
  assert.equal(parsedResult.command.parameters.limit, 5, "parser should read safe limit");
  assert.equal(parsedResult.command.metadata.executesCommand, false, "parser must not execute command");
  assert.equal(
    getWorkspaceReportTypeForAction(WORKSPACE_COMMAND_ACTIONS.collectRenderStatus),
    WORKSPACE_REPORT_TYPES.renderStatus,
    "report type registry should map status action",
  );

  const writer = new WorkspaceWriter();
  const writePlan = writer.buildWritePlan({
    fileName: "RENDER_LOGS_REPORT.md",
    content: "# RENDER_LOGS_REPORT\n\nAnalysis: `none`\n",
  });

  assert.equal(writePlan.ok, true, "workspace writer should build write plan");
  assert.equal(writePlan.canChangeState, false, "workspace writer skeleton must not change state");
  assert.equal(writePlan.tokensSpent, false, "workspace writer skeleton must not spend tokens");
  assert.equal(writePlan.workspacePath, "agent_workspace/RENDER_LOGS_REPORT.md", "writer should use allowlisted workspace path");
  assert.equal(writePlan.metadata.writesFilesystem, false, "writer skeleton must not write filesystem");
  assert.equal(writePlan.metadata.writesRepository, false, "writer skeleton must not write repository");
}

function runAgentRegistrySmoke() {
  const registry = new AgentRegistryService();
  const listResult = registry.listAgents();

  assertSafeAgentResult(listResult, "agent-registry");
  assert.equal(listResult.metadata.registryOnly, true, "agent registry should be metadata only");
  assert.equal(listResult.metadata.executesAgents, false, "agent registry must not execute agents");
  assert.equal(listResult.metadata.connectedToRuntime, false, "agent registry must not connect to runtime");
  assert.equal(listResult.metadata.connectedToTelegram, false, "agent registry must not connect to Telegram");
  assert.equal(listResult.metadata.connectedToRender, false, "agent registry must not connect to Render");
  assert.equal(listResult.metadata.connectedToAI, false, "agent registry must not connect to AI");
  assert.ok(listResult.data.agents.length >= 5, "agent registry should list known skeleton agents");

  for (const agent of listResult.data.agents) {
    assert.equal(agent.canChangeState, false, `${agent.id} must not change state`);
    assert.equal(agent.tokensSpent, false, `${agent.id} must not spend tokens`);
    assert.equal(agent.executesAgents, false, `${agent.id} metadata must not execute agents`);
  }

  const oneResult = registry.getAgent("render-logs-collector");
  assertSafeAgentResult(oneResult, "agent-registry");
  assert.equal(oneResult.data.agent.id, "render-logs-collector", "agent registry should return requested agent metadata");
  assert.equal(oneResult.metadata.executesAgents, false, "getAgent must not execute agents");
}

runRepoStateAgentSmoke();
runRepoMaintenanceAgentSmoke();
runRenderLogsCollectorSmoke();
runWorkspaceIoSmoke();
runAgentRegistrySmoke();

console.log("SG 2.0 agents skeleton smoke: OK");
