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

export async function ensureDiagnosticBootstrapReady({ command, config }) {
  const action = String(command?.action || "").toUpperCase();
  const payloadCommands = parseDiagnosticCommandLines(command?.payload || "");
  const chaosGateCommand = payloadCommands.find((cmd) => cmd === "/agent_bootstrap_chaos_gate_diag");

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
  if (!isAgentWorkspaceReadOnlyDiagnosticCommand(commandName)) {
    return {
      command: commandName,
      ok: false,
      error: "diagnostic_command_not_allowed_or_not_read_only",
    };
  }

  try {
    if (
      commandName === "/pm_capabilities_diag" ||
      commandName === "/pm_wiring_diag" ||
      commandName === "/memory_monarch_diag"
    ) {
      return executeAgentWorkspaceChatCommand(commandName);
    }

    if (commandName === "/agent_workspace_diag") {
      return { command: commandName, ok: true, data: getAgentWorkspaceDiag() };
    }

    if (commandName === "/agent_bootstrap_chaos_pillars_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "pillars_fail", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (commandName === "/agent_bootstrap_chaos_github_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "github_fail", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (commandName === "/agent_bootstrap_chaos_missing_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config });
      return {
        command: commandName,
        ok: data?.ok === true,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
      };
    }

    if (commandName === "/agent_bootstrap_chaos_gate_diag") {
      const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config });
      return {
        command: commandName,
        ok: false,
        data,
        outputText: buildAgentWorkspaceChaosDiagOutput({ data, title: "AgentWorkspace bootstrap chaos gate diag" }),
      };
    }

    if (commandName === "/agent_bootstrap_diag" || commandName === "/agent_bootstrap_strict_diag") {
      const data = await buildAgentWorkspaceBootstrapSnapshot({ config });
      const strictChecks = commandName === "/agent_bootstrap_strict_diag"
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
          commandName === "/agent_bootstrap_strict_diag"
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
      const state = await ensureGlobalRenderServiceSelected();
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
      const state = await ensureGlobalRenderServiceSelected();
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
