// src/agentWorkspace/AgentWorkspaceDiagnosticExecutor.js
// ============================================================================
// AgentWorkspace Diagnostic Executor
// Executes read-only diagnostic commands and diagnostic bootstrap safety gates.
// ============================================================================

import {
  getAgentWorkspaceDiag,
  isAgentWorkspaceReadOnlyDiagnosticCommand,
} from "./AgentWorkspaceConfig.js";
import { buildAgentWorkspaceBootstrapSnapshot, buildAgentWorkspaceBootstrapChaosSnapshot } from "./AgentWorkspaceBootstrapReader.js";
import { buildAgentWorkspaceChaosDiagOutput } from "./AgentWorkspaceChaosDiagFormatter.js";
import { executeAgentWorkspaceChatCommand } from "./AgentWorkspaceChatCommandExecutor.js";
import { parseDiagnosticCommandLines } from "./AgentWorkspacePayloadParser.js";
import {
  nowIso,
  buildDiagnosticTestReport,
} from "./AgentWorkspaceReportBuilders.js";
import renderBridge from "../integrations/render/RenderBridge.js";
import { getRenderBridgeConfig } from "../integrations/render/RenderBridgeConfig.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitCommandLine(commandLine = "") {
  const raw = normalizeString(commandLine);
  const parts = raw ? raw.split(/\s+/) : [];
  const commandName = parts[0] || "";
  const rest = parts.slice(1).join(" ").trim();
  return { raw, commandName, rest, parts: parts.slice(1) };
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseRenderDeploysArgs(rest = "", fallback = 5) {
  return clampInt(normalizeString(rest).split(/\s+/)[0], fallback, 1, 20);
}

function parseRenderLogsArgs(rest = "", defaults = {}) {
  const raw = normalizeString(rest);
  const parts = raw ? raw.split(/\s+/) : [];
  const first = String(parts[0] || "").toLowerCase();

  if (first === "latest" || first === "latest_deploy") {
    return {
      target: "latest_deploy",
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
    };
  }

  if (parts.length === 1 && Number.isFinite(Number(parts[0]))) {
    return {
      target: "time",
      minutes: defaults.minutes ?? 60,
      limit: clampInt(parts[0], defaults.limit ?? 50, 1, 300),
    };
  }

  return {
    target: "time",
    minutes: clampInt(parts[0], defaults.minutes ?? 60, 1, 1440),
    limit: clampInt(parts[1], defaults.limit ?? 50, 1, 300),
  };
}

function parseIsoMs(value) {
  const n = Date.parse(normalizeString(value));
  return Number.isFinite(n) ? n : 0;
}

function isoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function buildDeployLogWindow(deploy = null) {
  const createdMs = parseIsoMs(deploy?.createdAt);
  if (!createdMs) return { startTime: "", endTime: "" };

  const finishedMs = parseIsoMs(deploy?.finishedAt);
  const startMs = Math.max(0, createdMs - 30_000);
  const endMs = Math.max(finishedMs || Date.now(), createdMs + 60_000) + 30_000;

  return {
    startTime: isoFromMs(startMs),
    endTime: isoFromMs(endMs),
  };
}

function formatDeployLine(item, index) {
  return [
    `${index + 1}) deployId=${item?.id || "-"}`,
    `status=${item?.status || "-"}`,
    `createdAt=${item?.createdAt || "-"}`,
    `finishedAt=${item?.finishedAt || "-"}`,
    `commit=${item?.commit || "-"}`,
  ].join(" | ");
}

function formatRawLogLine(item, index) {
  const ts = item?.timestamp || "-";
  const lvl = item?.level || "-";
  const msg = normalizeString(item?.message) || "-";
  return `${index + 1}) [${ts}] [${lvl}] ${msg}`;
}

export async function ensureDiagnosticBootstrapReady({ command, config }) {
  const action = String(command?.action || "").toUpperCase();
  const payloadCommands = parseDiagnosticCommandLines(command?.payload || "");
  const chaosGateCommand = payloadCommands.find((cmd) => splitCommandLine(cmd).commandName === "/agent_bootstrap_chaos_gate_diag");

  if (action !== "RUN_DIAGNOSTIC_COMMANDS") {
    return {
      ok: true,
      skipped: true,
      reason: "not_diagnostic_test_action",
    };
  }

  const snapshot = chaosGateCommand
    ? await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config })
    : await buildAgentWorkspaceBootstrapSnapshot({ config });

  if (!chaosGateCommand && snapshot?.ok === true) {
    return {
      ok: true,
      skipped: false,
      snapshot,
    };
  }

  const failedFiles = Array.isArray(snapshot?.files)
    ? snapshot.files.filter((item) => !item.ok).map((item) => item.path).join(", ")
    : "-";
  const warnings = Array.isArray(snapshot?.warnings) && snapshot.warnings.length
    ? snapshot.warnings.join(", ")
    : "-";

  return {
    ok: false,
    skipped: false,
    snapshot,
    resultText: [
      chaosGateCommand
        ? "AgentWorkspace diagnostic bootstrap chaos gate blocked execution as expected."
        : "AgentWorkspace diagnostic bootstrap safety gate failed.",
      "Action blocked before diagnostics/tests execution.",
      `readOnly: ${snapshot?.readOnly ? "yes" : "no"}`,
      `dbWrites: ${snapshot?.dbWrites ? "yes" : "no"}`,
      `aiCalls: ${snapshot?.aiCalls ? "yes" : "no"}`,
      `touchesPillars: ${snapshot?.touchesPillars ? "yes" : "no"}`,
      `runtimePromptChanged: ${snapshot?.runtimePromptChanged ? "yes" : "no"}`,
      `chaosMode: ${snapshot?.chaosMode ? "yes" : "no"}`,
      `controlledSimulation: ${snapshot?.controlledSimulation ? "yes" : "no"}`,
      `scenario: ${snapshot?.scenario || "-"}`,
      `simulatedFailure: ${snapshot?.simulatedFailure || "-"}`,
      `filesExpected: ${snapshot?.filesExpected ?? "-"}`,
      `filesOk: ${snapshot?.filesOk ?? "-"}`,
      `filesFailed: ${snapshot?.filesFailed ?? "-"}`,
      `failedFiles: ${failedFiles || "-"}`,
      `warnings: ${warnings}`,
      "Result: FAILED",
    ].join("\n"),
  };
}

export async function executeDiagnosticCommand({ commandName, config, reportService, ensureGlobalRenderServiceSelected }) {
  const parsed = splitCommandLine(commandName);
  const cmd0 = parsed.commandName;

  if (!isAgentWorkspaceReadOnlyDiagnosticCommand(commandName)) {
    return {
      command: commandName,
      ok: false,
      error: "diagnostic_command_not_allowed_or_not_read_only",
    };
  }

  try {
    if (
      cmd0 === "/pm_capabilities_diag" ||
      cmd0 === "/pm_wiring_diag" ||
      cmd0 === "/memory_monarch_diag"
    ) {
      return executeAgentWorkspaceChatCommand(commandName);
    }

    if (cmd0 === "/agent_workspace_diag") {
      return { command: commandName, ok: true, data: getAgentWorkspaceDiag() };
    }

    if (cmd0 === "/agent_bootstrap_chaos_pillars_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "pillars_fail", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (cmd0 === "/agent_bootstrap_chaos_github_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "github_fail", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (cmd0 === "/agent_bootstrap_chaos_missing_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (cmd0 === "/agent_bootstrap_chaos_gate_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config });
      return {
        command: commandName,
        ok: false,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data, title: "AgentWorkspace bootstrap chaos gate diag" }),
      };
    }

    if (cmd0 === "/agent_bootstrap_diag" || cmd0 === "/agent_bootstrap_strict_diag") {
      const data = await buildAgentWorkspaceBootstrapSnapshot({ config });
      const strictChecks = cmd0 === "/agent_bootstrap_strict_diag"
        ? {
            readOnly: data?.readOnly === true,
            noDbWrites: data?.dbWrites === false,
            noAiCalls: data?.aiCalls === false,
            noPillarsTouch: data?.touchesPillars === false,
            noRuntimePromptChange: data?.runtimePromptChanged === false,
            allBootstrapFilesReadable: data?.ok === true,
          }
        : null;
      const strictOk = strictChecks
        ? Object.values(strictChecks).every((value) => value === true)
        : data?.ok === true;

      return {
        command: commandName,
        ok: strictOk,
        data: strictChecks ? { ...data, strictChecks } : data,
        outputText: [
          cmd0 === "/agent_bootstrap_strict_diag"
            ? "🧭 AgentWorkspace bootstrap strict diag"
            : "🧭 AgentWorkspace bootstrap diag",
          "",
          `readOnly: ${data?.readOnly ? "yes" : "no"}`,
          `dbWrites: ${data?.dbWrites ? "yes" : "no"}`,
          `aiCalls: ${data?.aiCalls ? "yes" : "no"}`,
          `touchesPillars: ${data?.touchesPillars ? "yes" : "no"}`,
          `runtimePromptChanged: ${data?.runtimePromptChanged ? "yes" : "no"}`,
          "",
          `repoFullName: ${data?.repoFullName || "-"}`,
          `branch: ${data?.branch || "-"}`,
          `filesExpected: ${data?.filesExpected ?? "-"}`,
          `filesOk: ${data?.filesOk ?? "-"}`,
          `filesFailed: ${data?.filesFailed ?? "-"}`,
          "",
          ...(Array.isArray(data?.files) ? data.files.map((item) => {
            return `${item.ok ? "OK" : "FAILED"}: ${item.path} chars=${item.chars} hash=${item.hash || "-"}`;
          }) : ["files: -"]),
          "",
          ...(strictChecks ? [
            "Strict checks:",
            ...Object.entries(strictChecks).map(([key, value]) => `${key}: ${value ? "yes" : "no"}`),
            "",
          ] : []),
          `warnings: ${Array.isArray(data?.warnings) && data.warnings.length ? data.warnings.join(", ") : "-"}`,
          "",
          `Result: ${strictOk ? "OK" : "FAILED"}`,
        ].join("\n"),
      };
    }

    if (cmd0 === "/render_bridge_diag") {
      return { command: commandName, ok: true, data: renderBridge.getDiag() };
    }

    if (cmd0 === "/render_bridge_services") {
      const services = await renderBridge.listServices();
      return {
        command: commandName,
        ok: true,
        data: services,
        outputText: [
          "✅ RAW RENDER SERVICES",
          `returned=${services.length}`,
          "",
          ...services.map((item, index) => {
            return `${index + 1}) serviceId=${item?.id || "-"} | name=${item?.name || "-"} | slug=${item?.slug || "-"} | ownerId=${item?.ownerId || "-"}`;
          }),
        ].join("\n"),
      };
    }

    if (cmd0 === "/render_bridge_deploys") {
      const state = await ensureGlobalRenderServiceSelected();
      const cfg = getRenderBridgeConfig();
      const limit = parseRenderDeploysArgs(parsed.rest, cfg.defaultDeployLimit || 5);
      const deploys = await renderBridge.listDeploys({
        serviceId: state.selected_service_id,
        limit,
      });

      return {
        command: commandName,
        ok: true,
        data: deploys,
        outputText: [
          "✅ RAW RENDER DEPLOYS",
          `serviceId=${state.selected_service_id}`,
          `limit=${limit}`,
          `returned=${deploys.length}`,
          "",
          ...deploys.map((item, index) => formatDeployLine(item, index)),
        ].join("\n"),
      };
    }

    if (cmd0 === "/render_bridge_logs") {
      const state = await ensureGlobalRenderServiceSelected();
      const cfg = getRenderBridgeConfig();
      const args = parseRenderLogsArgs(parsed.rest, {
        minutes: cfg.defaultLogWindowMinutes || 60,
        limit: cfg.defaultLogLimit || 50,
      });

      let deploy = null;
      let explicitWindow = null;

      if (args.target === "latest_deploy") {
        const deploys = await renderBridge.listDeploys({
          serviceId: state.selected_service_id,
          limit: 1,
        });
        deploy = deploys[0] || null;
        explicitWindow = buildDeployLogWindow(deploy);
      }

      const logs = await renderBridge.listRecentLogs({
        ownerId: state.selected_owner_id,
        serviceId: state.selected_service_id,
        level: "all",
        minutes: args.minutes,
        limit: args.limit,
        startTime: explicitWindow?.startTime || "",
        endTime: explicitWindow?.endTime || "",
      });

      return {
        command: commandName,
        ok: true,
        data: logs,
        outputText: [
          "✅ RAW RENDER LOGS",
          `ownerId=${state.selected_owner_id}`,
          `serviceId=${state.selected_service_id}`,
          `target=${args.target}`,
          `deployId=${deploy?.id || "-"}`,
          `deployStatus=${deploy?.status || "-"}`,
          `deployCommit=${deploy?.commit || "-"}`,
          `deployCreatedAt=${deploy?.createdAt || "-"}`,
          `deployFinishedAt=${deploy?.finishedAt || "-"}`,
          `windowMinutes=${args.minutes}`,
          `startTime=${explicitWindow?.startTime || "-"}`,
          `endTime=${explicitWindow?.endTime || "-"}`,
          `limit=${args.limit}`,
          `returned=${logs.length}`,
          "",
          ...logs.map((item, index) => formatRawLogLine(item, index)),
        ].join("\n"),
      };
    }

    if (cmd0 === "/render_bridge_diagnose") {
      await ensureGlobalRenderServiceSelected();
      const result = await reportService.collectRenderReport("diagnostic render-bridge-diagnose", "global");
      return {
        command: commandName,
        ok: true,
        data: result,
      };
    }

    return executeAgentWorkspaceChatCommand(commandName);
  } catch (error) {
    return {
      command: commandName,
      ok: false,
      error: error?.message || "unknown_error",
    };
  }
}

export async function runDiagnosticCommandsAction({ command, config, reportService, ensureGlobalRenderServiceSelected }) {
  const requested = parseDiagnosticCommandLines(command.payload);

  if (!requested.length) {
    throw new Error("agent_workspace_no_diagnostic_commands_in_payload");
  }

  const results = [];
  for (const cmd of requested) {
    results.push(await executeDiagnosticCommand({
      commandName: cmd,
      config,
      reportService,
      ensureGlobalRenderServiceSelected,
    }));
  }

  const collectedAt = nowIso();
  await reportService.writeMarkdown(
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

export default {
  ensureDiagnosticBootstrapReady,
  executeDiagnosticCommand,
  runDiagnosticCommandsAction,
};
