import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";
import { analyzeRepoStateProjectMap } from "./RepoStateAgentAiAnalyzer.js";
import { detectRepoStateAiNeed } from "./RepoStateAgentChangeDetector.js";
import { getLatestAiAnalysis, saveAiAnalysis } from "./RepoStateAgentAiRepository.js";

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run() {
    const result = await this.collector.runScan();

    const projectMap = buildRepoStateProjectMap(result?.snapshot || result);

    const repoFullName = result?.repoFullName || "";
    const branch = result?.branch || "";

    const previous = await getLatestAiAnalysis(repoFullName, branch);

    const changeDecision = detectRepoStateAiNeed({
      projectMap,
      previousAiState: previous
        ? { projectMapSignature: previous.project_map_signature }
        : null,
    });

    let aiAnalysis = {
      enabled: false,
      skipped: true,
      reason: changeDecision.reason,
    };

    if (changeDecision.shouldAnalyze) {
      const aiResult = await analyzeRepoStateProjectMap(projectMap);

      if (aiResult?.enabled && !aiResult?.skipped) {
        await saveAiAnalysis({
          repoFullName,
          branch,
          scanRunId: result?.persistence?.scanRunId || null,
          projectMapSignature: changeDecision.projectMapSignature,
          projectMap,
          analysis: aiResult.analysis,
        });

        aiAnalysis = aiResult;
      }
    } else if (previous) {
      aiAnalysis = {
        enabled: true,
        skipped: true,
        reused: true,
        analysis: previous.analysis,
      };
    }

    return {
      ...result,
      projectMap,
      aiAnalysis,
      aiMeta: changeDecision,
    };
  }
}

export default RepoStateAgentService;
