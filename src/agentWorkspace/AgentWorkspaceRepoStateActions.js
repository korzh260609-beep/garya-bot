// src/agentWorkspace/AgentWorkspaceRepoStateActions.js
// ============================================================================
// AgentWorkspace Repo State Actions
// Executes repo-state scan and full RepoStateAgent commands.
// ============================================================================

import { parseRepoStateAgentOptions } from "./AgentWorkspacePayloadParser.js";
import {
  nowIso,
  buildRepoStateScanTestReport,
  buildRepoStateAgentTestReport,
} from "./AgentWorkspaceReportBuilders.js";
import { createRepoStateCollector } from "../repoStateCollector/RepoStateCollectorFactory.js";
import RepoStateAgentService from "../simpleAgents/repoStateAgent/RepoStateAgentService.js";

export async function runRepoStateScanAction({ command, reportService }) {
  const { collector } = createRepoStateCollector();
  const snapshot = await collector.runScan();
  const collectedAt = nowIso();

  await reportService.writeMarkdown(
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

export async function runRepoStateAgentAction({ command, reportService, forceRealAi = false } = {}) {
  const service = new RepoStateAgentService();
  const parsedOptions = parseRepoStateAgentOptions(command.payload);
  const options = forceRealAi
    ? {
        ...parsedOptions,
        forceAiAnalysis: true,
      }
    : parsedOptions;
  const result = await service.run(options);
  const collectedAt = nowIso();

  await reportService.writeMarkdown(
    "TEST_REPORT.md",
    buildRepoStateAgentTestReport({ command, result, collectedAt }),
    `write full repo state agent results for ${command.taskId || "manual"}`
  );

  return {
    ok: result?.ok === true && result?.persisted === true,
    taskId: command.taskId || "manual",
    workflowPoint: command.workflowPoint || "-",
    repoStateAgent: true,
    repoStateAgentRealAiAction: forceRealAi === true,
    filesCount: result?.filesCount || 0,
    modulesCount: result?.modulesCount || 0,
    dependenciesCount: result?.dependenciesCount || 0,
    persisted: result?.persisted === true,
    scanRunId: result?.persistence?.scanRunId || null,
    aiEnabled: result?.aiAnalysis?.enabled === true,
    aiSkipped: result?.aiAnalysis?.skipped === true,
    aiReused: result?.aiAnalysis?.reused === true,
    aiReason: result?.aiAnalysis?.reason || result?.aiMeta?.reason || null,
    aiForceAnalysis: result?.aiMeta?.forceAiAnalysis === true ||
      result?.aiAnalysis?.forceAiAnalysis === true,
    allowRealAi: result?.aiMeta?.allowRealAi === true ||
      result?.aiAnalysis?.allowRealAi === true,
    realAiBlocked: result?.aiMeta?.realAiBlocked === true,
    tokensSpent: result?.aiAnalysis?.tokensSpent === true,
    result,
  };
}

export default {
  runRepoStateScanAction,
  runRepoStateAgentAction,
};
