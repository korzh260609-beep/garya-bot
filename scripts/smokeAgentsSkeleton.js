// AGENT NOTE:
// Smoke test for SG 2.0 agent skeletons.
// Purpose: verify repo/workspace/render collector skeletons import and remain safe.
// This script must not call Telegram, Render, GitHub, DB, OpenAI, or external services.

import assert from "node:assert/strict";
import { RepoStateAgentService } from "../src/agents/repo-intelligence/repo-state-agent/index.js";
import { RepoMaintenanceAgentService } from "../src/agents/repo-maintenance/repo-maintenance-agent/index.js";
import {
  RenderLogsCollectorService,
  RENDER_COLLECTOR_ACTIONS,
  RENDER_COLLECTOR_SAFETY,
  clampRenderDeploysLimit,
  clampRenderLogsLimit,
  isRenderCollectorActionAllowed,
} from "../src/agents/runtime-collector/render-logs-collector/index.js";
import { WorkspaceReaderAgentService } from "../src/agents/workspace/workspace-reader-agent/index.js";
import { WorkspaceWriterAgentService } from "../src/agents/workspace/workspace-writer-agent/index.js";
import { AgentInventoryAgentService } from "../src/agents/agent-intelligence/agent-inventory-agent/index.js";
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

function runRenderCollectorConfigSmoke() {
  assert.equal(isRenderCollectorActionAllowed(RENDER_COLLECTOR_ACTIONS.listDeploys), true, "list deploys should be allowlisted");
  assert.equal(isRenderCollectorActionAllowed("delete_service"), false, "mutating Render actions must not be allowlisted");
  assert.equal(clampRenderLogsLimit(99999), 1000, "logs limit should clamp to max");
  assert.equal(clampRenderLogsLimit("bad"), 100, "logs limit should fallback to default");
  assert.equal(clampRenderDeploysLimit(99999), 100, "deploys limit should clamp to max");
  assert.equal(RENDER_COLLECTOR_SAFETY.canChangeState, false, "render config must not allow state changes");
  assert.equal(RENDER_COLLECTOR_SAFETY.tokensSpent, false, "render config must not spend tokens");
  assert.equal(RENDER_COLLECTOR_SAFETY.connectedToRender, false, "render config skeleton must not connect to Render");
  assert.equal(RENDER_COLLECTOR_SAFETY.mutatesRender, false, "render config must not mutate Render");
  assert.equal(RENDER_COLLECTOR_SAFETY.analyzesLogs, false, "render config must not analyze logs");
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

function runWorkspaceAgentsSmoke() {
  const commandContent = `# COMMANDS\n\nCOMMAND_ID: smoke-002\nSTATUS: READY\nACTION: COLLECT_RENDER_STATUS\n`;

  const readerAgent = new WorkspaceReaderAgentService();
  const readerResult = readerAgent.parseProvidedWorkspaceCommand({ content: commandContent });

  assertSafeAgentResult(readerResult, "workspace-reader-agent");
  assert.equal(readerResult.metadata.readsFilesystem, false, "workspace reader agent must not read filesystem");
  assert.equal(readerResult.metadata.writesFilesystem, false, "workspace reader agent must not write filesystem");
  assert.equal(readerResult.metadata.executesWorkspaceAction, false, "workspace reader agent must not execute workspace actions");
  assert.equal(readerResult.data.parsedResult.command.reportType, WORKSPACE_REPORT_TYPES.renderStatus, "workspace reader agent should parse report type");

  const writerAgent = new WorkspaceWriterAgentService();
  const writerResult = writerAgent.buildWorkspaceWritePlan({
    fileName: "RENDER_STATUS_REPORT.md",
    content: "# RENDER_STATUS_REPORT\n\nAnalysis: `none`\n",
  });

  assertSafeAgentResult(writerResult, "workspace-writer-agent");
  assert.equal(writerResult.metadata.readsFilesystem, false, "workspace writer agent must not read filesystem");
  assert.equal(writerResult.metadata.writesFilesystem, false, "workspace writer agent must not write filesystem");
  assert.equal(writerResult.metadata.writesRepository, false, "workspace writer agent must not write repository");
  assert.equal(writerResult.metadata.executesWorkspaceAction, false, "workspace writer agent must not execute workspace actions");
  assert.equal(writerResult.data.writePlan.workspacePath, "agent_workspace/RENDER_STATUS_REPORT.md", "workspace writer agent should build allowlisted plan");
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
  assert.ok(listResult.data.agents.length >= 6, "agent registry should list known skeleton agents");

  for (const agent of listResult.data.agents) {
    assert.equal(agent.canChangeState, false, `${agent.id} must not change state`);
    assert.equal(agent.tokensSpent, false, `${agent.id} must not spend tokens`);
    assert.equal(agent.executesAgents, false, `${agent.id} metadata must not execute agents`);
  }

  const renderResult = registry.getAgent("render-logs-collector");
  assertSafeAgentResult(renderResult, "agent-registry");
  assert.equal(renderResult.data.agent.id, "render-logs-collector", "agent registry should return requested agent metadata");
  assert.equal(renderResult.metadata.executesAgents, false, "getAgent must not execute agents");

  const readerAgentResult = registry.getAgent("workspace-reader-agent");
  assertSafeAgentResult(readerAgentResult, "agent-registry");
  assert.equal(readerAgentResult.data.agent.modulePath, "src/agents/workspace/workspace-reader-agent", "workspace reader should be registered as agent folder");

  const writerAgentResult = registry.getAgent("workspace-writer-agent");
  assertSafeAgentResult(writerAgentResult, "agent-registry");
  assert.equal(writerAgentResult.data.agent.modulePath, "src/agents/workspace/workspace-writer-agent", "workspace writer should be registered as agent folder");

  const inventoryAgentResult = registry.getAgent("agent-inventory-agent");
  assertSafeAgentResult(inventoryAgentResult, "agent-registry");
  assert.equal(inventoryAgentResult.data.agent.modulePath, "src/agents/agent-intelligence/agent-inventory-agent", "agent inventory should be registered as agent folder");
}

function runAgentInventorySmoke() {
  const registry = new AgentRegistryService();
  const listResult = registry.listAgents();
  const inventoryAgent = new AgentInventoryAgentService();
  const inventoryResult = inventoryAgent.buildInventory({
    agents: listResult.data.agents,
    metadata: {
      source: "smoke_registry_output",
    },
  });

  assertSafeAgentResult(inventoryResult, "agent-inventory-agent");
  assert.equal(inventoryResult.metadata.readsRepository, false, "inventory agent must not read repository in skeleton");
  assert.equal(inventoryResult.metadata.connectedToGitHub, false, "inventory agent must not connect to GitHub");
  assert.equal(inventoryResult.metadata.connectedToAI, false, "inventory agent must not connect to AI");
  assert.equal(inventoryResult.metadata.storesMemory, false, "inventory agent must not store memory yet");
  assert.equal(inventoryResult.data.inventory.canChangeState, false, "inventory report must not change state");
  assert.equal(inventoryResult.data.inventory.tokensSpent, false, "inventory report must not spend tokens");
  assert.equal(inventoryResult.data.inventory.safetyWarnings.length, 0, "safe registry should produce no inventory safety warnings");
  assert.ok(inventoryResult.data.inventory.groupedByLayer.workspace.length >= 2, "inventory should group workspace agents");
  assert.ok(inventoryResult.data.inventory.groupedByLayer["agent-intelligence"].length >= 1, "inventory should include itself as agent-intelligence");
}

runRepoStateAgentSmoke();
runRepoMaintenanceAgentSmoke();
runRenderLogsCollectorSmoke();
runRenderCollectorConfigSmoke();
runWorkspaceIoSmoke();
runWorkspaceAgentsSmoke();
runAgentRegistrySmoke();
runAgentInventorySmoke();

console.log("SG 2.0 agents skeleton smoke: OK");
