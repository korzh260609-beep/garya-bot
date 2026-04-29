import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";
import { buildRepoStateNextActionPlan } from "./RepoStateNextActionPlanBuilder.js";
import { buildRepoStateArchitectureHealth } from "./RepoStateArchitectureHealthBuilder.js";
import { analyzeRepoStateProjectMap } from "./RepoStateAgentAiAnalyzer.js";
import { detectRepoStateAiNeed } from "./RepoStateAgentChangeDetector.js";
import { getLatestAiAnalysis, saveAiAnalysis } from "./RepoStateAgentAiRepository.js";
import {
  getLatestProjectMapState,
  saveProjectMapState,
} from "./RepoStateProjectMapStateRepository.js";

const DEFAULT_REPO_FULL_NAME = "korzh260609-beep/garya-bot";
const DEFAULT_BRANCH = "main";

function enrichAiExecution(aiAnalysis = {}) {
  if (aiAnalysis?.enabled !== true) {
    return {
      ...aiAnalysis,
      aiDryRun: false,
      tokensSpent: false,
      aiSource: "disabled",
    };
  }

  if (aiAnalysis?.reused === true) {
    return {
      ...aiAnalysis,
      aiDryRun: false,
      tokensSpent: false,
      aiSource: "reused_previous",
    };
  }

  if (
    aiAnalysis?.reason === "repo_state_agent_ai_dry_run" ||
    aiAnalysis?.analysis?.dryRun === true
  ) {
    return {
      ...aiAnalysis,
      aiDryRun: true,
      tokensSpent: false,
      aiSource: "dry_run",
    };
  }

  if (aiAnalysis?.skipped === true) {
    return {
      ...aiAnalysis,
      aiDryRun: false,
      tokensSpent: false,
      aiSource: "skipped_no_tokens",
    };
  }

  return {
    ...aiAnalysis,
    aiDryRun: false,
    tokensSpent: true,
    aiSource: "real_ai",
  };
}

function buildForcedDryRunAnalysis({ reason, forceAiAnalysis, allowRealAi }) {
  return {
    enabled: true,
    skipped: true,
    reason,
    forceAiAnalysis,
    allowRealAi,
    analysis: {
      dryRun: true,
      safetyGate: true,
      summary: "Real AI blocked by safety gate. No tokens were spent.",
    },
  };
}

function buildAiUsageMetadata(aiAnalysis = {}) {
  const usage = aiAnalysis?.usage || {};

  return {
    aiModel: usage.model || null,
    aiUsedFallback: usage.usedFallback === true,
    aiInputTokens: Number.isFinite(usage.inputTokens) ? usage.inputTokens : null,
    aiOutputTokens: Number.isFinite(usage.outputTokens) ? usage.outputTokens : null,
    aiTotalTokens: Number.isFinite(usage.totalTokens) ? usage.totalTokens : null,
    aiEstimatedUsd: Number.isFinite(usage.estimatedUsd) ? usage.estimatedUsd : null,
    aiPricingConfigured: usage.pricingConfigured === true,
    aiInputUsdPer1M: Number.isFinite(usage.inputUsdPer1M) ? usage.inputUsdPer1M : null,
    aiOutputUsdPer1M: Number.isFinite(usage.outputUsdPer1M) ? usage.outputUsdPer1M : null,
  };
}

function normalizeProjectMapFromState(state = null) {
  if (!state?.project_map || typeof state.project_map !== "object") {
    return null;
  }

  return state.project_map;
}

function buildFastReadOnlyResult({ repoFullName, branch, state, projectMap }) {
  const nextActionPlan = buildRepoStateNextActionPlan(projectMap);
  const architectureHealth = buildRepoStateArchitectureHealth(projectMap);

  return {
    ok: true,
    source: "repo_state_agent_fast_read_only",
    fastReadOnly: true,
    repoFullName,
    branch,
    snapshot: null,
    persistence: {
      scanRunId: state?.scan_run_id || null,
      reusedProjectMapStateId: state?.id || null,
      readOnly: true,
      writesSkipped: true,
    },
    projectMap,
    nextActionPlan,
    architectureHealth,
    aiAnalysis: enrichAiExecution({
      enabled: false,
      skipped: true,
      reason: "fast_read_only_reused_project_map_state",
    }),
    aiMeta: {
      fastReadOnly: true,
      reusedProjectMapState: true,
      tokensSpent: false,
      aiSource: "disabled",
    },
  };
}

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run(options = {}) {
    const forceAiAnalysis = options.forceAiAnalysis === true;
    const allowRealAi = options.allowRealAi === true;
    const fastReadOnly = options.fastReadOnly === true;
    const repoFullNameForFastRead = options.repoFullName || DEFAULT_REPO_FULL_NAME;
    const branchForFastRead = options.branch || DEFAULT_BRANCH;

    if (fastReadOnly) {
      const latestProjectMapState = await getLatestProjectMapState(repoFullNameForFastRead, branchForFastRead);
      const cachedProjectMap = normalizeProjectMapFromState(latestProjectMapState);

      if (cachedProjectMap) {
        return buildFastReadOnlyResult({
          repoFullName: repoFullNameForFastRead,
          branch: branchForFastRead,
          state: latestProjectMapState,
          projectMap: cachedProjectMap,
        });
      }
    }

    const result = await this.collector.runScan();

    const projectMap = buildRepoStateProjectMap(result?.snapshot || result);
    const nextActionPlan = buildRepoStateNextActionPlan(projectMap);
    const architectureHealth = buildRepoStateArchitectureHealth(projectMap);

    const repoFullName = result?.repoFullName || "";
    const branch = result?.branch || "";

    // NEW: project map state (works even when AI disabled)
    const previousState = await getLatestProjectMapState(repoFullName, branch);

    const previousSignature = previousState?.project_map_signature || null;

    const changeDecision = detectRepoStateAiNeed({
      projectMap,
      previousAiState: previousSignature
        ? { projectMapSignature: previousSignature }
        : null,
    });

    const shouldRunAi = changeDecision.shouldAnalyze || forceAiAnalysis;
    const realAiBlocked = shouldRunAi && !allowRealAi;

    const aiMeta = {
      ...changeDecision,
      forceAiAnalysis,
      allowRealAi,
      realAiBlocked,
      originalShouldAnalyze: changeDecision.shouldAnalyze === true,
    };

    let aiAnalysis = {
      enabled: false,
      skipped: true,
      reason: changeDecision.reason,
    };

    const previousAi = await getLatestAiAnalysis(repoFullName, branch);

    if (realAiBlocked) {
      aiAnalysis = buildForcedDryRunAnalysis({
        reason: "repo_state_agent_real_ai_blocked_without_allow_real_ai",
        forceAiAnalysis,
        allowRealAi,
      });
    } else if (shouldRunAi) {
      const aiResult = await analyzeRepoStateProjectMap(projectMap);

      aiAnalysis = aiResult;

      if (forceAiAnalysis) {
        aiAnalysis = {
          ...aiResult,
          forceAiAnalysis: true,
          allowRealAi,
          originalShouldAnalyze: changeDecision.shouldAnalyze === true,
        };
      }

      if (aiResult?.enabled && aiResult?.skipped !== true) {
        await saveAiAnalysis({
          repoFullName,
          branch,
          scanRunId: result?.persistence?.scanRunId || null,
          projectMapSignature: changeDecision.projectMapSignature,
          projectMap,
          analysis: aiResult.analysis,
        });
      }
    } else if (previousAi) {
      aiAnalysis = {
        enabled: true,
        skipped: true,
        reused: true,
        analysis: previousAi.analysis,
      };
    }

    aiAnalysis = enrichAiExecution(aiAnalysis);
    const aiUsageMetadata = buildAiUsageMetadata(aiAnalysis);

    // NEW: always persist project map state (even when AI disabled)
    await saveProjectMapState({
      repoFullName,
      branch,
      scanRunId: result?.persistence?.scanRunId || null,
      projectMapSignature: changeDecision.projectMapSignature,
      projectMap,
      aiEnabled: aiAnalysis?.enabled === true,
      metadata: {
        forceAiAnalysis,
        allowRealAi,
        realAiBlocked,
        originalShouldAnalyze: changeDecision.shouldAnalyze === true,
        aiReason: aiAnalysis?.reason || changeDecision.reason,
        aiDryRun: aiAnalysis?.aiDryRun === true,
        tokensSpent: aiAnalysis?.tokensSpent === true,
        aiSource: aiAnalysis?.aiSource || "unknown",
        nextActionPlanSchemaVersion: nextActionPlan?.schemaVersion || null,
        nextActionPlanGeneratedBy: nextActionPlan?.generatedBy || null,
        nextActionPlanTokensSpent: nextActionPlan?.tokensSpent === true,
        architectureHealthSchemaVersion: architectureHealth?.schemaVersion || null,
        architectureHealthGeneratedBy: architectureHealth?.generatedBy || null,
        architectureHealthTokensSpent: architectureHealth?.tokensSpent === true,
        architectureHealthScore: architectureHealth?.score || null,
        architectureHealthStatus: architectureHealth?.status || null,
        ...aiUsageMetadata,
      },
    });

    return {
      ...result,
      projectMap,
      nextActionPlan,
      architectureHealth,
      aiAnalysis,
      aiMeta: {
        ...aiMeta,
        ...aiUsageMetadata,
      },
    };
  }
}

export default RepoStateAgentService;
