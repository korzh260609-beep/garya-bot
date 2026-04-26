// src/agentWorkspace/AgentWorkspaceReportService.js
// ============================================================================
// Agent workspace report service.
// PURPOSE:
// - write controlled markdown reports into agent_workspace/
// - collect RenderBridge evidence without changing production automatically
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import {
  getAgentWorkspaceConfig,
  getAgentWorkspaceDiag,
} from "./AgentWorkspaceConfig.js";
import renderBridge from "../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../integrations/render/RenderBridgeStateStore.js";
import { getRenderBridgeConfig } from "../integrations/render/RenderBridgeConfig.js";
import RenderLogDiagnosisService from "../logging/RenderLogDiagnosisService.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function cut(value, max = 1200) {
  const s = normalizeString(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function parseArgs(rest = "") {
  const raw = normalizeString(rest);
  const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];

  return {
    taskId: tokens[0] || "manual",
    workflowPoint: tokens[1] || "-",
    deployId: tokens[2] || "",
  };
}

function formatLogs(logs = [], maxLines = 12) {
  if (!logs.length) return "-";

  return logs.slice(0, maxLines).map((item, index) => {
    const ts = item?.timestamp || "-";
    const lvl = item?.level || "-";
    const msg = cut(String(item?.message || "").replace(/\s+/g, " "), 240);
    return `${index + 1}) [${ts}] [${lvl}] ${msg || "-"}`;
  }).join("\n");
}

function buildDeployReport({ taskId, workflowPoint, state, deploy, collectedAt }) {
  return `# DEPLOY_REPORT

Render deploy metadata collected after Monarch starts deploy.

---

Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Commit: \`${deploy?.commit || "-"}\`
Deploy ID: \`${deploy?.id || "-"}\`
Service ID: \`${state?.selected_service_id || "-"}\`
Service name: \`${state?.selected_service_name || "-"}\`
Status: \`${deploy?.status || "unknown"}\`
Started at: \`${deploy?.createdAt || "-"}\`
Finished at: \`${deploy?.finishedAt || "-"}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG RenderBridge\`

---

## Deploy summary

- Render deploy data was collected through RenderBridge.
- No automatic rollback or code modification was performed.

## RenderBridge command/source

- \`/agent_workspace_render_report\`

## Raw important fields

\`\`\`text
serviceId=${state?.selected_service_id || "-"}
serviceName=${state?.selected_service_name || "-"}
serviceSlug=${state?.selected_service_slug || "-"}
ownerId=${state?.selected_owner_id || "-"}
deployId=${deploy?.id || "-"}
status=${deploy?.status || "unknown"}
commit=${deploy?.commit || "-"}
createdAt=${deploy?.createdAt || "-"}
finishedAt=${deploy?.finishedAt || "-"}
\`\`\`

## Result

- \`${deploy?.status || "UNKNOWN"}\`
`;
}

function buildRenderReport({ taskId, deploy, state, logs, collectedAt }) {
  const errorCount = logs.length;
  return `# RENDER_REPORT

Render runtime logs, snapshots, and operational evidence.

---

Task ID: \`${taskId}\`
Deploy ID: \`${deploy?.id || "-"}\`
Commit: \`${deploy?.commit || "-"}\`
Source key: \`render_primary\`
Service ID: \`${state?.selected_service_id || "-"}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG RenderBridge\`

---

## Logs summary

- Collected error-level logs from selected Render service.
- Error log lines found: \`${errorCount}\`.

## Errors found

${errorCount ? "- Yes" : "- No error logs found in selected window"}

## Error snapshots

\`\`\`text
${formatLogs(logs, 20)}
\`\`\`

## Runtime observations

- No code changes were made by SG.
- This report is diagnostic evidence only.

## Risk flags

${errorCount ? "- Runtime errors require advisor review." : "- No immediate Render error signal in collected window."}
`;
}

function buildDiagnosisReport({ taskId, deploy, diagnosis, collectedAt }) {
  const fp = diagnosis?.fingerprint || {};
  const corr = diagnosis?.correlation || {};
  const top = corr?.topCandidate || null;
  const win = corr?.lineWindow || null;

  return `# DIAGNOSIS

SG diagnosis based on Render logs, deploy metadata, and test evidence.

---

Task ID: \`${taskId}\`
Deploy ID: \`${deploy?.id || "-"}\`
Commit: \`${deploy?.commit || "-"}\`
Diagnosis version: \`${diagnosis?.diagnosisVersion || "-"}\`
Created at: \`${collectedAt}\`
Created by: \`SG\`

---

## Short diagnosis

${diagnosis?.shortText || "-"}

## Error kind

- \`${fp?.kind || "unknown"}\`

## Candidate file

- \`${top?.path || "-"}\`

## Candidate line/window

- exactLine: \`${win?.exactLine || "-"}\`
- window: \`${win ? `${win.startLine || "-"}-${win.endLine || "-"}` : "-"}\`

## Likely cause

- ${fp?.likelyCause || "нужна дополнительная проверка"}

## Confidence

- \`${corr?.confidence || fp?.confidence || "very_low"}\`

## First check

- Advisor must verify against repo code before any next patch.

## Advisor decision

- \`PENDING_REVIEW\`
`;
}

function buildStatusReport({ taskId, workflowPoint, deploy, logs, collectedAt }) {
  const hasErrors = logs.length > 0;
  return `# STATUS

Current state of the development loop.

---

## Current status

State: \`${hasErrors ? "NEEDS_REVIEW" : "DEPLOY_CHECKED"}\`
Updated at: \`${collectedAt}\`
Updated by: \`SG RenderBridge\`
Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Commit: \`${deploy?.commit || "-"}\`
Deploy ID: \`${deploy?.id || "-"}\`

### Summary

${hasErrors ? "Render errors were found. Advisor review required." : "Deploy checked. No error logs found in selected window."}

### Done

- Deploy metadata collected.
- Render logs collected.
- Diagnosis report generated when log text was available.

### Not done

- No automatic code changes.
- No automatic deploy action.

### Blockers

${hasErrors ? "- Runtime errors need review." : "- None from collected Render evidence."}

### Next action

${hasErrors ? "- Advisor reads DIAGNOSIS.md and decides fix/stop." : "- Advisor may verify Telegram behavior using TEST_REPORT.md."}
`;
}

function buildLoopStateReport({ taskId, deploy, logs, collectedAt }) {
  const hasErrors = logs.length > 0;
  return `# LOOP_STATE

Finite control state for the development loop.

---

Task ID: \`${taskId}\`
State: \`${hasErrors ? "NEEDS_FIX" : "DEPLOY_CHECKED"}\`
Attempt: \`1\`
Max attempts: \`3\`
Last approved by Monarch: \`true\`
Last commit: \`${deploy?.commit || "-"}\`
Last deploy ID: \`${deploy?.id || "-"}\`
Last verification result: \`${hasErrors ? "NEEDS_REVIEW" : "NO_RENDER_ERRORS_FOUND"}\`
Updated at: \`${collectedAt}\`

---

## State machine

\`\`\`text
REQUESTED
→ PLAN_PROPOSED
→ APPROVED
→ COMMITTED
→ DEPLOYING
→ DEPLOY_CHECKED
→ VERIFIED_OK | NEEDS_FIX | STOP_MANUAL_REVIEW
\`\`\`

---

## Stop rules

- Stop if \`Attempt >= Max attempts\`.
- Stop if Render deploy fails without clear diagnosis.
- Stop if diagnosis confidence is \`very_low\` after repeated failure.
- Stop if requested fix would change architecture without Monarch approval.
- Stop if DECISIONS / WORKFLOW conflict is detected.
`;
}

function buildTestReport({ taskId, note, collectedAt }) {
  return `# TEST_REPORT

SG chat-command test results after deploy.

---

Task ID: \`${taskId}\`
Deploy ID: \`-\`
Commit: \`-\`
Tested at: \`${collectedAt}\`
Tested by: \`Advisor via SG commands / Monarch-assisted testing\`

---

## Test commands

\`\`\`text
${note?.commands || "-"}
\`\`\`

## Expected answers

${note?.expected || "-"}

## Actual answers

\`\`\`text
${note?.actual || "-"}
\`\`\`

## Chat response logs

\`\`\`text
${note?.chatLogs || "-"}
\`\`\`

## Render logs during test

\`\`\`text
${note?.renderLogs || "-"}
\`\`\`

## Result

- \`${note?.result || "UNKNOWN"}\`

## Notes

${note?.notes || "-"}
`;
}

export class AgentWorkspaceReportService {
  constructor({ config, client } = {}) {
    this.config = config || getAgentWorkspaceConfig();
    this.client = client || new AgentWorkspaceGitHubClient({ config: this.config });
  }

  getDiag() {
    return getAgentWorkspaceDiag();
  }

  async writeMarkdown(fileName, content, message) {
    if (!this.config.allowedFiles.includes(fileName)) {
      throw new Error(`agent_workspace_file_not_allowed:${fileName}`);
    }

    return this.client.writeFile(fileName, content, message);
  }

  async collectRenderReport(rest = "", ownerKey = "global") {
    const { taskId, workflowPoint, deployId } = parseArgs(rest);
    const collectedAt = nowIso();
    const state = await renderBridgeStateStore.getState(ownerKey || "global");

    if (!state?.selected_service_id) {
      throw new Error("agent_workspace_render_service_not_selected");
    }

    const bridgeCfg = getRenderBridgeConfig();
    const deploys = await renderBridge.listDeploys({
      serviceId: state.selected_service_id,
      limit: 1,
    });

    let deploy = deploys[0] || null;
    if (deployId) {
      deploy = await renderBridge.getDeploy({
        serviceId: state.selected_service_id,
        deployId,
      });
    }

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: bridgeCfg.defaultLogLevel,
      minutes: bridgeCfg.defaultLogWindowMinutes,
      limit: bridgeCfg.defaultLogLimit,
    });

    const logText = formatLogs(logs, 50);
    let diagnosis = null;

    if (logs.length > 0) {
      const diagnosisService = new RenderLogDiagnosisService();
      diagnosis = await diagnosisService.diagnose(logText, {
        source: "agent_workspace_render_report",
        taskId,
        workflowPoint,
      });
    }

    const writes = [];
    writes.push(await this.writeMarkdown(
      "DEPLOY_REPORT.md",
      buildDeployReport({ taskId, workflowPoint, state, deploy, collectedAt }),
      `update deploy report for ${taskId}`
    ));

    writes.push(await this.writeMarkdown(
      "RENDER_REPORT.md",
      buildRenderReport({ taskId, deploy, state, logs, collectedAt }),
      `update render report for ${taskId}`
    ));

    writes.push(await this.writeMarkdown(
      "STATUS.md",
      buildStatusReport({ taskId, workflowPoint, deploy, logs, collectedAt }),
      `update status for ${taskId}`
    ));

    writes.push(await this.writeMarkdown(
      "LOOP_STATE.md",
      buildLoopStateReport({ taskId, deploy, logs, collectedAt }),
      `update loop state for ${taskId}`
    ));

    if (diagnosis) {
      writes.push(await this.writeMarkdown(
        "DIAGNOSIS.md",
        buildDiagnosisReport({ taskId, deploy, diagnosis, collectedAt }),
        `update diagnosis for ${taskId}`
      ));
    }

    return {
      ok: true,
      taskId,
      workflowPoint,
      deployId: deploy?.id || null,
      commit: deploy?.commit || null,
      logs: logs.length,
      diagnosis: Boolean(diagnosis),
      writes,
    };
  }

  async writeTestNote(rest = "") {
    const raw = normalizeString(rest);
    const taskId = raw.split(/\s+/)[0] || "manual";
    const noteText = raw.replace(taskId, "").trim();
    const collectedAt = nowIso();

    const note = {
      commands: noteText || "manual test note",
      expected: "See request context.",
      actual: noteText || "-",
      chatLogs: noteText || "-",
      renderLogs: "Use /agent_workspace_render_report to collect Render logs.",
      result: "MANUAL_NOTE",
      notes: "This report was written from a Telegram command note.",
    };

    const write = await this.writeMarkdown(
      "TEST_REPORT.md",
      buildTestReport({ taskId, note, collectedAt }),
      `update test report for ${taskId}`
    );

    return {
      ok: true,
      taskId,
      write,
    };
  }
}

export const agentWorkspaceReportService = new AgentWorkspaceReportService();

export default agentWorkspaceReportService;
