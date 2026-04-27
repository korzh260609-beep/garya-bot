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
  isAgentWorkspaceReadOnlyDiagnosticCommand,
} from "./AgentWorkspaceConfig.js";
import { buildAgentWorkspaceBootstrapSnapshot, buildAgentWorkspaceBootstrapChaosSnapshot } from "./AgentWorkspaceBootstrapReader.js";
import { buildAgentWorkspaceChaosDiagOutput } from "./AgentWorkspaceChaosDiagFormatter.js";
import {
  parseAgentWorkspaceCommand,
  buildAgentWorkspaceCommandMarkdown,
} from "./AgentWorkspaceCommandParser.js";
import { executeAgentWorkspaceChatCommand } from "./AgentWorkspaceChatCommandExecutor.js";
import { createRepoStateCollector } from "../repoStateCollector/RepoStateCollectorFactory.js";
import RepoStateAgentService from "../simpleAgents/repoStateAgent/RepoStateAgentService.js";
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
  return `# ${title}\n\nReset before current command run.\n\n---\n\nTask ID: \`${taskId || "-"}\`\nUpdated at: \`${nowIso()}\`\nReason: \`${reason}\`\n\n---\n\n-\n`;
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

function normalizeCommitSha(value) {
  return normalizeString(value).toLowerCase();
}

function getRuntimeCommitSha() {
  return normalizeCommitSha(
    process.env.RENDER_GIT_COMMIT ||
    process.env.RENDER_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    ""
  );
}

async function isCommitSatisfied({ runtimeCommit, requiredCommit, client }) {
  const runtime = normalizeCommitSha(runtimeCommit);
  const required = normalizeCommitSha(requiredCommit);

  if (!required) return true;
  if (!runtime) return false;
  if (runtime === required || runtime.startsWith(required) || required.startsWith(runtime)) return true;

  if (!client || typeof client.compareCommits !== "function") return false;

  try {
    const compare = await client.compareCommits(required, runtime);

    return compare?.ok === true && (
      compare.status === "identical" ||
      compare.status === "ahead"
    );
  } catch (error) {
    console.error("AgentWorkspace commit ancestry check failed:", error?.message || error);
    return false;
  }
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

  return `# TEST_REPORT\n\nSG diagnostic command results after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test commands\n\n\`\`\`text\n${parseDiagnosticCommandLines(command.payload).join("\n") || "-"}\n\`\`\`\n\n## Expected answers\n\nThe runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.\n\n## Actual answers\n\n\`\`\`text\n${executed}\n\`\`\`\n\n## Chat response logs\n\n\`\`\`text\n${chatOutput || "-"}\n\`\`\`\n\n## Render logs during test\n\n\`\`\`text\nUse RENDER_REPORT.md for RenderBridge logs collected by verify actions.\n\`\`\`\n\n## Result\n\n- \`${results.every((item) => item.ok) ? "DIAGNOSTICS_OK" : "DIAGNOSTICS_FAILED"}\`\n\n## Notes\n\n${raw || "-"}\n`;
}

function buildRepoStateScanTestReport({ command, snapshot, collectedAt }) {
  return `# TEST_REPORT\n\nSG repo state scan result after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test command\n\n\`\`\`text\nRUN_REPO_STATE_SCAN\n\`\`\`\n\n## Result\n\n- \`${snapshot?.ok === true && snapshot?.persisted === true ? "REPO_STATE_SCAN_OK" : "REPO_STATE_SCAN_FAILED"}\`\n\n## Repo State\n\n\`\`\`text\nok: ${snapshot?.ok === true ? "yes" : "no"}\npersisted: ${snapshot?.persisted === true ? "yes" : "no"}\nrepo: ${snapshot?.repoFullName || "-"}\nbranch: ${snapshot?.branch || "-"}\nfiles: ${snapshot?.filesCount ?? "-"}\nmodules: ${snapshot?.modulesCount ?? "-"}\ndependencies: ${snapshot?.dependenciesCount ?? "-"}\ncontentLoaded: ${snapshot?.tree?.contentFilesLoaded ?? "-"}\ncontentSkipped: ${snapshot?.tree?.contentFilesSkipped ?? "-"}\nstructureComplete: ${snapshot?.tree?.structureComplete === true ? "yes" : "no"}\nhiddenFiles: ${snapshot?.tree?.hiddenFilesCount ?? "-"}\nscanRunId: ${snapshot?.persistence?.scanRunId || "-"}\nerror: ${snapshot?.error || snapshot?.persistence?.error || "-"}\n\`\`\`\n\n## Raw\n\n\`\`\`json\n${safeJson(snapshot || {}, 6000)}\n\`\`\`\n`;
}

function buildRepoStateAgentTestReport({ command, result, collectedAt }) {
  const ai = result?.aiAnalysis || {};
  const meta = result?.aiMeta || {};
  const projectMap = result?.projectMap || {};
  return `# TEST_REPORT\n\nSG full repo state agent result after workspace command execution.\n\n---\n\nTask ID: \`${command.taskId || "manual"}\`\nDeploy ID: \`${command.deployId || "-"}\`\nCommit: \`-\`\nTested at: \`${collectedAt}\`\nTested by: \`SG AgentWorkspaceCommandRunner\`\n\n---\n\n## Test command\n\n\`\`\`text\nRUN_REPO_STATE_AGENT\n\`\`\`\n\n## Result\n\n- \`${result?.ok === true && result?.persisted === true && projectMap ? "REPO_STATE_AGENT_OK" : "REPO_STATE_AGENT_FAILED"}\`\n\n## Technical map\n\n\`\`\`text\nok: ${result?.ok === true ? "yes" : "no"}\npersisted: ${result?.persisted === true ? "yes" : "no"}\nrepo: ${result?.repoFullName || "-"}\nbranch: ${result?.branch || "-"}\nfiles: ${result?.filesCount ?? "-"}\nmodules: ${result?.modulesCount ?? "-"}\ndependencies: ${result?.dependenciesCount ?? "-"}\nprojectMap: ${projectMap ? "yes" : "no"}\nprojectMapModules: ${Array.isArray(projectMap?.modules) ? projectMap.modules.length : "-"}\nprojectMapLinks: ${Array.isArray(projectMap?.moduleLinks) ? projectMap.moduleLinks.length : "-"}\nscanRunId: ${result?.persistence?.scanRunId || "-"}\nerror: ${result?.error || result?.persistence?.error || "-"}\n\`\`\`\n\n## Semantic AI map\n\n\`\`\`text\naiEnabled: ${ai?.enabled === true ? "yes" : "no"}\naiSkipped: ${ai?.skipped === true ? "yes" : "no"}\naiReused: ${ai?.reused === true ? "yes" : "no"}\naiReason: ${ai?.reason || meta?.reason || "-"}\nshouldAnalyze: ${meta?.shouldAnalyze === true ? "yes" : "no"}\nsignatureLength: ${meta?.projectMapSignature ? String(meta.projectMapSignature.length) : "-"}\nhasAnalysis: ${ai?.analysis ? "yes" : "no"}\n\`\`\`\n\n## Raw compact\n\n\`\`\`json\n${safeJson({
    ok: result?.ok,
    persisted: result?.persisted,
    repoFullName: result?.repoFullName,
    branch: result?.branch,
    filesCount: result?.filesCount,
    modulesCount: result?.modulesCount,
    dependenciesCount: result?.dependenciesCount,
    scanRunId: result?.persistence?.scanRunId || null,
    aiAnalysis: result?.aiAnalysis || null,
    aiMeta: result?.aiMeta || null,
  }, 6000)}\n\`\`\`\n`;
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
    return isAgentWorkspaceReadOnlyDiagnosticCommand(command);
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

  async ensureDiagnosticBootstrapReady(command) {
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
      ? await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config: this.config })
      : await buildAgentWorkspaceBootstrapSnapshot({ config: this.config });

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
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "pillars_fail", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
        };
      }

      if (commandName === "/agent_bootstrap_chaos_github_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "github_fail", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
        };
      }

      if (commandName === "/agent_bootstrap_chaos_missing_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: buildAgentWorkspaceChaosDiagOutput({ data }),
        };
      }

      if (commandName === "/agent_bootstrap_chaos_gate_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config: this.config });
        return {
          command: commandName,
          ok: false,
          data,
          outputText: buildAgentWorkspaceChaosDiagOutput({ data, title: "AgentWorkspace bootstrap chaos gate diag" }),
        };
      }

      if (commandName === "/agent_bootstrap_diag" || commandName === "/agent_bootstrap_strict_diag") {
        const data = await buildAgentWorkspaceBootstrapSnapshot({ config: this.config });
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

      return executeAgentWorkspaceChatCommand(commandName);
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

  async runRepoStateScan(command) {
    const { collector } = createRepoStateCollector();
    const snapshot = await collector.runScan();
    const collectedAt = nowIso();

    await this.reportService.writeMarkdown(
      "TEST_REPORT.md",
      buildRepoStateScanTestReport({ command, snapshot, collectedAt }),
      `write repo state scan results for ${command.taskId || "manual"}`
    );

    return {
      ok: snapshot?.ok === true && snapshot?.persisted === true,
      taskId: command.taskId || "manual",
      workflowPoint: command.workflowPoint || "-",
      repoStateScan: true,
      filesCount: snapshot?.filesCount || 0,
      modulesCount: snapshot?.modulesCount || 0,
      dependenciesCount: snapshot?.dependenciesCount || 0,
      persisted: snapshot?.persisted === true,
      scanRunId: snapshot?.persistence?.scanRunId || null,
      result: snapshot,
    };
  }

  async runRepoStateAgent(command) {
    const service = new RepoStateAgentService();
    const result = await service.run();
    const collectedAt = nowIso();

    await this.reportService.writeMarkdown(
      "TEST_REPORT.md",
      buildRepoStateAgentTestReport({ command, result, collectedAt }),
      `write full repo state agent results for ${command.taskId || "manual"}`
    );

    return {
      ok: result?.ok === true && result?.persisted === true,
      taskId: command.taskId || "manual",
      workflowPoint: command.workflowPoint || "-",
      repoStateAgent: true,
      filesCount: result?.filesCount || 0,
      modulesCount: result?.modulesCount || 0,
      dependenciesCount: result?.dependenciesCount || 0,
      persisted: result?.persisted === true,
      scanRunId: result?.persistence?.scanRunId || null,
      aiEnabled: result?.aiAnalysis?.enabled === true,
      aiSkipped: result?.aiAnalysis?.skipped === true,
      aiReused: result?.aiAnalysis?.reused === true,
      aiReason: result?.aiAnalysis?.reason || result?.aiMeta?.reason || null,
      result,
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

    if (action === "RUN_REPO_STATE_SCAN") {
      return this.runRepoStateScan(command);
    }

    if (action === "RUN_REPO_STATE_AGENT") {
      return this.runRepoStateAgent(command);
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
      const requiredCommit = normalizeCommitSha(command.requiresCommit || "");
      const runtimeCommit = getRuntimeCommitSha();

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

      const commitSatisfied = await isCommitSatisfied({
        runtimeCommit,
        requiredCommit,
        client: this.client,
      });

      if (requiredCommit && !commitSatisfied) {
        return {
          ok: true,
          skipped: true,
          reason: "required_commit_not_active_yet",
          commandId,
          status,
          action,
          source,
          requiredCommit,
          runtimeCommit: runtimeCommit || null,
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

      const bootstrapGate = await this.ensureDiagnosticBootstrapReady(command);
      if (!bootstrapGate.ok) {
        await this.markCommand(command, "FAILED", bootstrapGate.resultText || "AgentWorkspace diagnostic bootstrap safety gate failed.");
        return {
          ok: false,
          commandId,
          action,
          reason: "diagnostic_bootstrap_safety_gate_failed",
          bootstrapGate,
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
          `Commit: ${result?.commit || result?.latestCommit || runtimeCommit || "-"}`,
          `Required commit: ${requiredCommit || "-"}`,
          `Runtime commit: ${runtimeCommit || "-"}`,
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
        requiredCommit,
        runtimeCommit,
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
