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

function positiveInt(value, fallback, min = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(min, Math.trunc(Number(fallback) || min));
  return Math.max(min, Math.trunc(n));
}

function nonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(n));
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
  const raw = normalizeString(value).replace(/\s+/g, " ");
  const n = Number(max);
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (raw.length <= n) return raw;
  return `${raw.slice(0, n - 1)}…`;
}

function safeLevel(value) {
  const v = normalizeString(value).toLowerCase();
  if (["error", "warn", "warning", "info", "debug", "all", "*"].includes(v)) return v;
  return "error";
}

function safeTarget(value) {
  const v = normalizeString(value || "latest_count").toLowerCase();
  if (["latest_count", "latest_deploy", "previous_deploy", "deploy"].includes(v)) return v;
  throw new Error(`agent_workspace_render_logs_target_not_allowed:${v || "empty"}`);
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

function formatLogs(logs = [], maxItems = 100, maxLineChars = 700, offset = 0) {
  if (!logs.length) return "-";
  return logs.slice(0, maxItems).map((item, index) => {
    const ts = item?.timestamp || "-";
    const lvl = item?.level || "-";
    const msg = cut(item?.message || "", maxLineChars);
    return `${offset + index + 1}) [${ts}] [${lvl}] ${msg || "-"}`;
  }).join("\n");
}

function parseIsoMs(value) {
  const n = Date.parse(normalizeString(value));
  return Number.isFinite(n) ? n : 0;
}

function isoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function buildDeployLogWindow(selectedDeploy = null) {
  if (!selectedDeploy?.createdAt) {
    return { startTime: "", endTime: "" };
  }

  const createdMs = parseIsoMs(selectedDeploy.createdAt);
  const finishedMs = parseIsoMs(selectedDeploy.finishedAt);
  if (!createdMs) return { startTime: "", endTime: "" };

  const startMs = Math.max(0, createdMs - 30_000);
  const endMs = Math.max(finishedMs || Date.now(), createdMs + 60_000) + 30_000;

  return {
    startTime: isoFromMs(startMs),
    endTime: isoFromMs(endMs),
  };
}

function partFileName(index) {
  return `RENDER_LOGS_REPORT_PART_${String(index + 1).padStart(3, "0")}.md`;
}

function splitLogs(logs = [], partSize = 500) {
  const size = positiveInt(partSize, 500, 1);
  const parts = [];
  for (let i = 0; i < logs.length; i += size) {
    parts.push(logs.slice(i, i + size));
  }
  return parts;
}

function buildLogQuerySummary(args = {}, selectedDeploy = null, explicitWindow = null, levelUsed = null, fallbackUsed = false) {
  return [
    `target=${args.target || "latest_count"}`,
    `deployId=${selectedDeploy?.id || args.deployId || "-"}`,
    `deployStatus=${selectedDeploy?.status || "-"}`,
    `deployCommit=${selectedDeploy?.commit || "-"}`,
    `deployCreatedAt=${selectedDeploy?.createdAt || "-"}`,
    `deployFinishedAt=${selectedDeploy?.finishedAt || "-"}`,
    `startTime=${explicitWindow?.startTime || "-"}`,
    `endTime=${explicitWindow?.endTime || "-"}`,
    `levelUsed=${levelUsed || args.level || "-"}`,
    `fallbackUsed=${fallbackUsed ? "yes" : "no"}`,
  ].join("\n");
}

function buildLogsReport({ taskId, workflowPoint, state, logs, args, selectedDeploy, explicitWindow, levelUsed, fallbackUsed, collectedAt }) {
  return `# RENDER_LOGS_REPORT\n\nControlled Render logs report collected by AgentWorkspace Render Control v1.\n\n---\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nCollected at: \`${collectedAt}\`\nCollected by: \`SG AgentWorkspaceRenderControlService\`\n\n---\n\n## Query\n\n\`\`\`text\nlevel=${args.level}\nlimit=${args.limit}\npartSize=${args.partSize}\nmaxLineChars=${args.maxLineChars}\n${buildLogQuerySummary(args, selectedDeploy, explicitWindow, levelUsed, fallbackUsed)}\n\`\`\`\n\n## Selected service\n\n\`\`\`text\n${formatServiceLine(state)}\n\`\`\`\n\n## Summary\n\n- Logs returned: \`${logs.length}\`\n- Parts: \`1\`\n- Chat output: \`on_request_only\`\n- Secrets/env exposure: \`blocked_by_design\`\n- Code changes: \`none\`\n\n## Logs\n\n\`\`\`text\n${formatLogs(logs, args.limit, args.maxLineChars)}\n\`\`\`\n`;
}

function buildLogsIndexReport({ taskId, workflowPoint, state, logs, args, selectedDeploy, explicitWindow, levelUsed, fallbackUsed, collectedAt, parts }) {
  const files = parts.map((part, index) => {
    const start = index * args.partSize + 1;
    const end = start + part.length - 1;
    return `- ${partFileName(index)} | lines=${part.length} | range=${start}-${end}`;
  }).join("\n");

  return `# RENDER_LOGS_REPORT\n\nControlled Render logs report index collected by AgentWorkspace Render Control v1.\n\n---\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nCollected at: \`${collectedAt}\`\nCollected by: \`SG AgentWorkspaceRenderControlService\`\n\n---\n\n## Query\n\n\`\`\`text\nlevel=${args.level}\nlimit=${args.limit}\npartSize=${args.partSize}\nmaxLineChars=${args.maxLineChars}\n${buildLogQuerySummary(args, selectedDeploy, explicitWindow, levelUsed, fallbackUsed)}\n\`\`\`\n\n## Selected service\n\n\`\`\`text\n${formatServiceLine(state)}\n\`\`\`\n\n## Summary\n\n- Logs returned: \`${logs.length}\`\n- Parts: \`${parts.length}\`\n- Chat output: \`on_request_only\`\n- Secrets/env exposure: \`blocked_by_design\`\n- Code changes: \`none\`\n\n## Part files\n\n${files || "-"}\n`;
}

function buildLogsPartReport({ taskId, workflowPoint, args, selectedDeploy, collectedAt, part, partIndex, totalParts, offset }) {
  return `# RENDER_LOGS_REPORT_PART_${String(partIndex + 1).padStart(3, "0")}\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nCollected at: \`${collectedAt}\`\nPart: \`${partIndex + 1}/${totalParts}\`\nDeploy ID: \`${selectedDeploy?.id || args.deployId || "-"}\`\nTarget: \`${args.target}\`\n\n---\n\n\`\`\`text\n${formatLogs(part, part.length, args.maxLineChars, offset)}\n\`\`\`\n`;
}

function buildDeploysReport({ taskId, workflowPoint, state, deploys, args, collectedAt }) {
  return `# RENDER_DEPLOYS_REPORT\n\nControlled Render deploys report collected by AgentWorkspace Render Control v1.\n\n---\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nCollected at: \`${collectedAt}\`\nCollected by: \`SG AgentWorkspaceRenderControlService\`\n\n---\n\n## Query\n\n\`\`\`text\nlimit=${args.limit}\n\`\`\`\n\n## Selected service\n\n\`\`\`text\n${formatServiceLine(state)}\n\`\`\`\n\n## Summary\n\n- Deploys returned: \`${deploys.length}\`\n- Code changes: \`none\`\n\n## Deploys\n\n\`\`\`text\n${formatDeploys(deploys, args.limit)}\n\`\`\`\n`;
}

function buildDeployReport({ taskId, workflowPoint, state, deploy, args, collectedAt }) {
  return `# RENDER_DEPLOY_REPORT\n\nControlled single Render deploy report collected by AgentWorkspace Render Control v1.\n\n---\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nDeploy ID: \`${deploy?.id || args.deployId || "-"}\`\nCommit: \`${deploy?.commit || "-"}\`\nStatus: \`${deploy?.status || "unknown"}\`\nCollected at: \`${collectedAt}\`\nCollected by: \`SG AgentWorkspaceRenderControlService\`\n\n---\n\n## Selected service\n\n\`\`\`text\n${formatServiceLine(state)}\n\`\`\`\n\n## Deploy\n\n\`\`\`text\nid=${deploy?.id || "-"}\nstatus=${deploy?.status || "unknown"}\ncommit=${deploy?.commit || "-"}\ncreatedAt=${deploy?.createdAt || "-"}\nfinishedAt=${deploy?.finishedAt || "-"}\n\`\`\`\n`;
}

function buildStatusReport({ taskId, workflowPoint, state, diag, deploys, collectedAt }) {
  const latest = deploys[0] || null;
  return `# RENDER_STATUS_REPORT\n\nControlled Render status report collected by AgentWorkspace Render Control v1.\n\n---\n\nTask ID: \`${taskId}\`\nWorkflow point: \`${workflowPoint}\`\nCollected at: \`${collectedAt}\`\nCollected by: \`SG AgentWorkspaceRenderControlService\`\n\n---\n\n## RenderBridge\n\n\`\`\`text\nenabled=${String(diag?.enabled)}\nready=${String(diag?.ready)}\nhasApiKey=${String(diag?.hasApiKey)}\ntimeoutMs=${diag?.timeoutMs || "-"}\ndefaultLogLevel=${diag?.defaultLogLevel || "-"}\ndefaultLogWindowMinutes=${diag?.defaultLogWindowMinutes || "-"}\ndefaultLogLimit=${diag?.defaultLogLimit || "-"}\n\`\`\`\n\n## Selected service\n\n\`\`\`text\n${formatServiceLine(state)}\n\`\`\`\n\n## Latest deploy\n\n\`\`\`text\nid=${latest?.id || "-"}\nstatus=${latest?.status || "unknown"}\ncommit=${latest?.commit || "-"}\ncreatedAt=${latest?.createdAt || "-"}\nfinishedAt=${latest?.finishedAt || "-"}\n\`\`\`\n`;
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
      level: safeLevel(payload.level || bridgeCfg.defaultLogLevel || "error"),
      limit: positiveInt(payload.limit, bridgeCfg.defaultLogLimit || 100, 1),
      partSize: positiveInt(payload.partSize, 500, 1),
      maxLineChars: nonNegativeInt(payload.maxLineChars, 0),
      deployId: normalizeString(payload.deployId || command.deployId || ""),
      target: safeTarget(payload.target || (payload.deployId || command.deployId ? "deploy" : "latest_count")),
    };
  }

  async resolveLogTarget({ state, args }) {
    if (args.target === "latest_count") {
      return { selectedDeploy: null, explicitWindow: null };
    }

    const deploys = await renderBridge.listDeploys({
      serviceId: state.selected_service_id,
      limit: 10,
    });

    let selectedDeploy = null;

    if (args.deployId) {
      selectedDeploy = deploys.find((deploy) => deploy?.id === args.deployId) || null;
      if (!selectedDeploy) {
        selectedDeploy = await renderBridge.getDeploy({
          serviceId: state.selected_service_id,
          deployId: args.deployId,
        });
      }
    } else if (args.target === "latest_deploy") {
      selectedDeploy = deploys[0] || null;
    } else if (args.target === "previous_deploy") {
      selectedDeploy = deploys[1] || null;
    } else if (args.target === "deploy") {
      throw new Error("agent_workspace_render_deploy_id_required");
    }

    return {
      selectedDeploy,
      explicitWindow: buildDeployLogWindow(selectedDeploy),
    };
  }

  async collectLogsWithFallbacks({ state, args, explicitWindow }) {
    const requested = args.level;
    const fallbackLevels = requested === "all" || requested === "*"
      ? ["all", "info", "warn", "error"]
      : [requested];

    let lastError = null;

    for (const level of fallbackLevels) {
      try {
        const logs = args.target === "latest_count"
          ? await renderBridge.listLogsByCount({
              ownerId: state.selected_owner_id,
              serviceId: state.selected_service_id,
              level,
              limit: args.limit,
            })
          : await renderBridge.listRecentLogs({
              ownerId: state.selected_owner_id,
              serviceId: state.selected_service_id,
              level,
              limit: args.limit,
              startTime: explicitWindow?.startTime || "",
              endTime: explicitWindow?.endTime || "",
            });

        return {
          logs,
          levelUsed: level,
          fallbackUsed: level !== requested,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("render_logs_collection_failed");
  }

  async writeChunkedLogsReport({ args, state, logs, selectedDeploy, explicitWindow, levelUsed, fallbackUsed, collectedAt }) {
    const parts = splitLogs(logs, args.partSize);

    if (parts.length <= 1) {
      const write = await this.writeMarkdown(
        "RENDER_LOGS_REPORT.md",
        buildLogsReport({
          taskId: args.taskId,
          workflowPoint: args.workflowPoint,
          state,
          logs,
          args,
          selectedDeploy,
          explicitWindow,
          levelUsed,
          fallbackUsed,
          collectedAt,
        }),
        `update render logs report for ${args.taskId}`
      );
      return { write, partsWritten: 1 };
    }

    if (parts.length > 10) {
      throw new Error(`agent_workspace_render_logs_too_many_parts:${parts.length}`);
    }

    const indexWrite = await this.writeMarkdown(
      "RENDER_LOGS_REPORT.md",
      buildLogsIndexReport({
        taskId: args.taskId,
        workflowPoint: args.workflowPoint,
        state,
        logs,
        args,
        selectedDeploy,
        explicitWindow,
        levelUsed,
        fallbackUsed,
        collectedAt,
        parts,
      }),
      `update render logs index for ${args.taskId}`
    );

    for (let i = 0; i < parts.length; i += 1) {
      await this.writeMarkdown(
        partFileName(i),
        buildLogsPartReport({
          taskId: args.taskId,
          workflowPoint: args.workflowPoint,
          args,
          selectedDeploy,
          collectedAt,
          part: parts[i],
          partIndex: i,
          totalParts: parts.length,
          offset: i * args.partSize,
        }),
        `update render logs part ${i + 1} for ${args.taskId}`
      );
    }

    return { write: indexWrite, partsWritten: parts.length };
  }

  async collectLogs(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");
    const { selectedDeploy, explicitWindow } = await this.resolveLogTarget({ state, args });
    const { logs, levelUsed, fallbackUsed } = await this.collectLogsWithFallbacks({
      state,
      args,
      explicitWindow,
    });

    const { write, partsWritten } = await this.writeChunkedLogsReport({
      args,
      state,
      logs,
      selectedDeploy,
      explicitWindow,
      levelUsed,
      fallbackUsed,
      collectedAt,
    });

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      deployId: selectedDeploy?.id || args.deployId || null,
      commit: selectedDeploy?.commit || null,
      target: args.target,
      levelUsed,
      fallbackUsed,
      logs: logs.length,
      partsWritten,
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
