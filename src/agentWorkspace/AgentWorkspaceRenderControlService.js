// src/agentWorkspace/AgentWorkspaceRenderControlService.js
// ============================================================================
// AgentWorkspace Render Control v1.
// PURPOSE:
// - collect Render logs/deploys/status through controlled workspace actions
// - write only allowlisted markdown reports into agent_workspace/
// - never expose env, tokens, API keys, or arbitrary Render data dumps
// ============================================================================

import AgentWorkspaceGitHubClient from "./AgentWorkspaceGitHubClient.js";
import { getAgentWorkspaceConfig } from "./AgentWorkspaceConfig.js";
import renderBridge from "../integrations/render/RenderBridge.js";
import renderBridgeStateStore from "../integrations/render/RenderBridgeStateStore.js";
import { getRenderBridgeConfig } from "../integrations/render/RenderBridgeConfig.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parsePayload(payload = "") {
  const out = {};
  const lines = String(payload || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  for (const line of lines) {
    const m = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim();
  }

  return out;
}

function cut(value, max = 500) {
  const s = normalizeString(value).replace(/\s+/g, " ");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function safeLevel(value) {
  const v = normalizeString(value).toLowerCase();
  if (["error", "warn", "warning", "info", "debug", "all"].includes(v)) return v;
  return "error";
}

function serviceMatchesGaryaBot(service = {}) {
  const name = String(service?.name || "").toLowerCase();
  const slug = String(service?.slug || "").toLowerCase();
  return name === "garya-bot" || slug === "garya-bot";
}

function formatServiceLine(state = {}) {
  return [
    `serviceId=${state?.selected_service_id || "-"}`,
    `serviceName=${state?.selected_service_name || "-"}`,
    `serviceSlug=${state?.selected_service_slug || "-"}`,
    `ownerId=${state?.selected_owner_id || "-"}`,
  ].join("\n");
}

function formatDeploys(deploys = [], maxItems = 20) {
  if (!deploys.length) return "-";
  return deploys.slice(0, maxItems).map((deploy, index) => {
    return [
      `${index + 1}) id=${deploy?.id || "-"}`,
      `status=${deploy?.status || "unknown"}`,
      `commit=${deploy?.commit || "-"}`,
      `createdAt=${deploy?.createdAt || "-"}`,
      `finishedAt=${deploy?.finishedAt || "-"}`,
    ].join(" | ");
  }).join("\n");
}

function formatLogs(logs = [], maxItems = 100, maxLineChars = 700) {
  if (!logs.length) return "-";
  return logs.slice(0, maxItems).map((item, index) => {
    const ts = item?.timestamp || "-";
    const lvl = item?.level || "-";
    const msg = cut(item?.message || "", maxLineChars);
    return `${index + 1}) [${ts}] [${lvl}] ${msg || "-"}`;
  }).join("\n");
}

function buildLogsReport({ taskId, workflowPoint, state, logs, args, collectedAt }) {
  return `# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG AgentWorkspaceRenderControlService\`

---

## Query

\`\`\`text
level=${args.level}
minutes=${args.minutes}
limit=${args.limit}
maxLineChars=${args.maxLineChars}
\`\`\`

## Selected service

\`\`\`text
${formatServiceLine(state)}
\`\`\`

## Summary

- Logs returned: \`${logs.length}\`
- Secrets/env exposure: \`blocked_by_design\`
- Code changes: \`none\`

## Logs

\`\`\`text
${formatLogs(logs, args.limit, args.maxLineChars)}
\`\`\`
`;
}

function buildDeploysReport({ taskId, workflowPoint, state, deploys, args, collectedAt }) {
  return `# RENDER_DEPLOYS_REPORT

Controlled Render deploys report collected by AgentWorkspace Render Control v1.

---

Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG AgentWorkspaceRenderControlService\`

---

## Query

\`\`\`text
limit=${args.limit}
\`\`\`

## Selected service

\`\`\`text
${formatServiceLine(state)}
\`\`\`

## Summary

- Deploys returned: \`${deploys.length}\`
- Code changes: \`none\`

## Deploys

\`\`\`text
${formatDeploys(deploys, args.limit)}
\`\`\`
`;
}

function buildDeployReport({ taskId, workflowPoint, state, deploy, args, collectedAt }) {
  return `# RENDER_DEPLOY_REPORT

Controlled single Render deploy report collected by AgentWorkspace Render Control v1.

---

Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Deploy ID: \`${deploy?.id || args.deployId || "-"}\`
Commit: \`${deploy?.commit || "-"}\`
Status: \`${deploy?.status || "unknown"}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG AgentWorkspaceRenderControlService\`

---

## Selected service

\`\`\`text
${formatServiceLine(state)}
\`\`\`

## Deploy

\`\`\`text
id=${deploy?.id || "-"}
status=${deploy?.status || "unknown"}
commit=${deploy?.commit || "-"}
createdAt=${deploy?.createdAt || "-"}
finishedAt=${deploy?.finishedAt || "-"}
\`\`\`
`;
}

function buildStatusReport({ taskId, workflowPoint, state, diag, deploys, collectedAt }) {
  const latest = deploys[0] || null;
  return `# RENDER_STATUS_REPORT

Controlled Render status report collected by AgentWorkspace Render Control v1.

---

Task ID: \`${taskId}\`
Workflow point: \`${workflowPoint}\`
Collected at: \`${collectedAt}\`
Collected by: \`SG AgentWorkspaceRenderControlService\`

---

## RenderBridge

\`\`\`text
enabled=${String(diag?.enabled)}
ready=${String(diag?.ready)}
hasApiKey=${String(diag?.hasApiKey)}
timeoutMs=${diag?.timeoutMs || "-"}
defaultLogLevel=${diag?.defaultLogLevel || "-"}
defaultLogWindowMinutes=${diag?.defaultLogWindowMinutes || "-"}
defaultLogLimit=${diag?.defaultLogLimit || "-"}
\`\`\`

## Selected service

\`\`\`text
${formatServiceLine(state)}
\`\`\`

## Latest deploy

\`\`\`text
id=${latest?.id || "-"}
status=${latest?.status || "unknown"}
commit=${latest?.commit || "-"}
createdAt=${latest?.createdAt || "-"}
finishedAt=${latest?.finishedAt || "-"}
\`\`\`
`;
}

export class AgentWorkspaceRenderControlService {
  constructor({ config, client } = {}) {
    this.config = config || getAgentWorkspaceConfig();
    this.client = client || new AgentWorkspaceGitHubClient({ config: this.config });
  }

  async writeMarkdown(fileName, content, message) {
    if (!this.config.allowedFiles.includes(fileName)) {
      throw new Error(`agent_workspace_file_not_allowed:${fileName}`);
    }
    return this.client.writeFile(fileName, content, message);
  }

  async ensureServiceSelected(ownerKey = "global") {
    const current = await renderBridgeStateStore.getState(ownerKey);
    if (current?.selected_service_id) return current;

    const services = await renderBridge.listServices();
    const selected = services.find(serviceMatchesGaryaBot) || (services.length === 1 ? services[0] : null);

    if (!selected?.id) {
      throw new Error("agent_workspace_no_render_service_available");
    }

    return renderBridgeStateStore.setSelectedService({
      ownerKey,
      serviceId: selected.id,
      serviceName: selected.name || selected.slug || "garya-bot",
      serviceSlug: selected.slug || selected.name || "garya-bot",
      ownerId: selected.ownerId || selected.owner?.id || selected.owner_id || null,
    });
  }

  buildArgs(command = {}) {
    const payload = parsePayload(command.payload || "");
    const bridgeCfg = getRenderBridgeConfig();

    return {
      taskId: command.taskId || "manual",
      workflowPoint: command.workflowPoint || "-",
      service: normalizeString(payload.service || payload.serviceName || payload.serviceSlug || ""),
      level: safeLevel(payload.level || bridgeCfg.defaultLogLevel || "error"),
      minutes: clampInt(payload.minutes, bridgeCfg.defaultLogWindowMinutes || 60, 1, 1440),
      limit: clampInt(payload.limit, bridgeCfg.defaultLogLimit || 100, 1, 300),
      maxLineChars: clampInt(payload.maxLineChars, 700, 120, 1200),
      deployId: normalizeString(payload.deployId || command.deployId || ""),
    };
  }

  async collectLogs(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");

    const logs = await renderBridge.listRecentLogs({
      ownerId: state.selected_owner_id,
      serviceId: state.selected_service_id,
      level: args.level,
      minutes: args.minutes,
      limit: args.limit,
    });

    const write = await this.writeMarkdown(
      "RENDER_LOGS_REPORT.md",
      buildLogsReport({ taskId: args.taskId, workflowPoint: args.workflowPoint, state, logs, args, collectedAt }),
      `update render logs report for ${args.taskId}`
    );

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      logs: logs.length,
      write,
    };
  }

  async collectDeploys(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");
    const deploys = await renderBridge.listDeploys({
      serviceId: state.selected_service_id,
      limit: args.limit,
    });

    const write = await this.writeMarkdown(
      "RENDER_DEPLOYS_REPORT.md",
      buildDeploysReport({ taskId: args.taskId, workflowPoint: args.workflowPoint, state, deploys, args, collectedAt }),
      `update render deploys report for ${args.taskId}`
    );

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      deploys: deploys.length,
      latestDeployId: deploys[0]?.id || null,
      latestCommit: deploys[0]?.commit || null,
      write,
    };
  }

  async collectDeploy(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");

    if (!args.deployId) {
      throw new Error("agent_workspace_render_deploy_id_required");
    }

    const deploy = await renderBridge.getDeploy({
      serviceId: state.selected_service_id,
      deployId: args.deployId,
    });

    const write = await this.writeMarkdown(
      "RENDER_DEPLOY_REPORT.md",
      buildDeployReport({ taskId: args.taskId, workflowPoint: args.workflowPoint, state, deploy, args, collectedAt }),
      `update render deploy report for ${args.taskId}`
    );

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      deployId: deploy?.id || args.deployId,
      commit: deploy?.commit || null,
      status: deploy?.status || "unknown",
      write,
    };
  }

  async collectStatus(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");
    const diag = renderBridge.getDiag();
    const deploys = await renderBridge.listDeploys({
      serviceId: state.selected_service_id,
      limit: 1,
    });

    const write = await this.writeMarkdown(
      "RENDER_STATUS_REPORT.md",
      buildStatusReport({ taskId: args.taskId, workflowPoint: args.workflowPoint, state, diag, deploys, collectedAt }),
      `update render status report for ${args.taskId}`
    );

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      ready: diag?.ready === true,
      latestDeployId: deploys[0]?.id || null,
      latestCommit: deploys[0]?.commit || null,
      write,
    };
  }
}

export const agentWorkspaceRenderControlService = new AgentWorkspaceRenderControlService();

export default agentWorkspaceRenderControlService;
