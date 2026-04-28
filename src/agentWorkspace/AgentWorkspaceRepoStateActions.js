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

function readAiUsageFields(result = {}) {
  const meta = result?.aiMeta || {};
  const usage = result?.aiAnalysis?.usage || {};

  return {
    aiModel: meta.aiModel || usage.model || null,
    aiUsedFallback: meta.aiUsedFallback === true || usage.usedFallback === true,
    aiInputTokens: Number.isFinite(meta.aiInputTokens) ? meta.aiInputTokens :
      Number.isFinite(usage.inputTokens) ? usage.inputTokens : null,
    aiOutputTokens: Number.isFinite(meta.aiOutputTokens) ? meta.aiOutputTokens :
      Number.isFinite(usage.outputTokens) ? usage.outputTokens : null,
    aiTotalTokens: Number.isFinite(meta.aiTotalTokens) ? meta.aiTotalTokens :
      Number.isFinite(usage.totalTokens) ? usage.totalTokens : null,
    aiEstimatedUsd: Number.isFinite(meta.aiEstimatedUsd) ? meta.aiEstimatedUsd :
      Number.isFinite(usage.estimatedUsd) ? usage.estimatedUsd : null,
    aiPricingConfigured: meta.aiPricingConfigured === true || usage.pricingConfigured === true,
    aiInputUsdPer1M: Number.isFinite(meta.aiInputUsdPer1M) ? meta.aiInputUsdPer1M :
      Number.isFinite(usage.inputUsdPer1M) ? usage.inputUsdPer1M : null,
    aiOutputUsdPer1M: Number.isFinite(meta.aiOutputUsdPer1M) ? meta.aiOutputUsdPer1M :
      Number.isFinite(usage.outputUsdPer1M) ? usage.outputUsdPer1M : null,
  };
}

function buildRepoStateAgentResultStatus({ result, realAiBlocked, forceRealAi }) {
  if (forceRealAi === true && realAiBlocked === true) {
    return "REAL_AI_BLOCKED";
  }

  if (result?.ok === true && result?.persisted === true) {
    if (result?.aiAnalysis?.aiDryRun === true) {
      return "REPO_STATE_AGENT_OK_DRY_RUN";
    }

    return "REPO_STATE_AGENT_OK";
  }

  return "REPO_STATE_AGENT_FAILED";
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
  const realAiBlocked = result?.aiMeta?.realAiBlocked === true;
  const resultStatus = buildRepoStateAgentResultStatus({
    result,
    realAiBlocked,
    forceRealAi,
  });
  const aiUsageFields = readAiUsageFields(result);

  await reportService.writeMarkdown(
    "TEST_REPORT.md",
    buildRepoStateAgentTestReport({ command, result, collectedAt, resultStatus }),
    `write full repo state agent results for ${command.taskId || "manual"}`
  );

  return {
    ok: result?.ok === true && result?.persisted === true,
    resultStatus,
    blocked: forceRealAi === true && realAiBlocked === true,
    blockReason: forceRealAi === true && realAiBlocked === true ? "missing_allow_real_ai" : null,
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
    realAiBlocked,
    tokensSpent: result?.aiAnalysis?.tokensSpent === true,
    ...aiUsageFields,
    result,
  };
}

export default {
  runRepoStateScanAction,
  runRepoStateAgentAction,
};
