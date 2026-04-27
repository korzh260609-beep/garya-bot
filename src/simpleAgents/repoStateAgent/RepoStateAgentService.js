import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";
import { analyzeRepoStateProjectMap } from "./RepoStateAgentAiAnalyzer.js";
import { detectRepoStateAiNeed } from "./RepoStateAgentChangeDetector.js";

let inMemoryAiState = null;

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run() {
    const result = await this.collector.runScan();

    const projectMap = buildRepoStateProjectMap(result?.snapshot || result);

    const changeDecision = detectRepoStateAiNeed({
      projectMap,
      previousAiState: inMemoryAiState,
    });

    let aiAnalysis = {
      enabled: false,
      skipped: true,
      reason: changeDecision.reason,
    };

    if (changeDecision.shouldAnalyze) {
      aiAnalysis = await analyzeRepoStateProjectMap(projectMap);

      if (aiAnalysis?.enabled && !aiAnalysis?.skipped) {
        inMemoryAiState = {
          projectMapSignature: changeDecision.projectMapSignature,
          analysis: aiAnalysis.analysis,
        };
      }
    } else if (inMemoryAiState) {
      aiAnalysis = {
        enabled: true,
        skipped: true,
        reused: true,
        analysis: inMemoryAiState.analysis,
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
