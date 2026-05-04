// AGENT NOTE:
// Smoke test for SG 2.0 agent skeletons.
// Purpose: verify repo/workspace/render collector skeletons import and remain safe.
// This script must not call Telegram, Render, GitHub, DB, OpenAI, or external services.

import assert from "node:assert/strict";
import { RepoStateAgentService } from "../src/agents/repo-intelligence/repo-state-agent/index.js";
import { RepoMaintenanceAgentService } from "../src/agents/repo-maintenance/repo-maintenance-agent/index.js";
import { RenderLogsCollectorService } from "../src/agents/runtime-collector/render-logs-collector/index.js";
import { getLatestWorkspaceResult } from "../src/agents/shared/workspace/WorkspaceResultStore.js";

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

runRepoStateAgentSmoke();
runRepoMaintenanceAgentSmoke();
runRenderLogsCollectorSmoke();

console.log("SG 2.0 agents skeleton smoke: OK");
