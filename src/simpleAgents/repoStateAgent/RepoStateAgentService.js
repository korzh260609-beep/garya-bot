import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";
import { analyzeRepoStateProjectMap } from "./RepoStateAgentAiAnalyzer.js";
import { detectRepoStateAiNeed } from "./RepoStateAgentChangeDetector.js";
import { getLatestAiAnalysis, saveAiAnalysis } from "./RepoStateAgentAiRepository.js";
import {
  getLatestProjectMapState,
  saveProjectMapState,
} from "./RepoStateProjectMapStateRepository.js";

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

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run(options = {}) {
    const forceAiAnalysis = options.forceAiAnalysis === true;

    const result = await this.collector.runScan();

    const projectMap = buildRepoStateProjectMap(result?.snapshot || result);

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

    const aiMeta = {
      ...changeDecision,
      forceAiAnalysis,
      originalShouldAnalyze: changeDecision.shouldAnalyze === true,
    };

    let aiAnalysis = {
      enabled: false,
      skipped: true,
      reason: changeDecision.reason,
    };

    const previousAi = await getLatestAiAnalysis(repoFullName, branch);

    if (changeDecision.shouldAnalyze || forceAiAnalysis) {
      const aiResult = await analyzeRepoStateProjectMap(projectMap);

      aiAnalysis = aiResult;

      if (forceAiAnalysis) {
        aiAnalysis = {
          ...aiResult,
          forceAiAnalysis: true,
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
        originalShouldAnalyze: changeDecision.shouldAnalyze === true,
        aiReason: aiAnalysis?.reason || changeDecision.reason,
        aiDryRun: aiAnalysis?.aiDryRun === true,
        tokensSpent: aiAnalysis?.tokensSpent === true,
        aiSource: aiAnalysis?.aiSource || "unknown",
      },
    });

    return {
      ...result,
      projectMap,
      aiAnalysis,
      aiMeta,
    };
  }
}

export default RepoStateAgentService;
