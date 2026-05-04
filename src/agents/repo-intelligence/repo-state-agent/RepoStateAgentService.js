// AGENT NOTE:
// RepoStateAgent service skeleton.
// Purpose: coordinate deterministic repo-state builders from provided input only.
// Do not connect this service to Telegram, GitHub runtime, DB, AI, or external tools yet.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { buildRepoStateArchitectureHealth } from "./RepoStateArchitectureHealthBuilder.js";
import { buildRepoStateNextActionPlan } from "./RepoStateNextActionPlanBuilder.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";

export class RepoStateAgentService {
  constructor({ agentName = "repo-state-agent" } = {}) {
    this.agentName = agentName;
  }

  analyze(input = {}) {
    try {
      const projectMap = buildRepoStateProjectMap(input);
      const architectureHealth = buildRepoStateArchitectureHealth(projectMap);
      const nextActionPlan = buildRepoStateNextActionPlan(projectMap);

      return createAgentResult({
        agent: this.agentName,
        capability: "repo_intelligence_read_only",
        data: {
          projectMap,
          architectureHealth,
          nextActionPlan,
        },
        warnings: [
          "RepoStateAgent V1 uses only provided input. It does not read GitHub/runtime by itself.",
        ],
        metadata: {
          mode: "skeleton_v1",
          connectedToRuntime: false,
          connectedToAI: false,
          connectedToDatabase: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "skeleton_v1",
        },
      });
    }
  }
}

export default RepoStateAgentService;
