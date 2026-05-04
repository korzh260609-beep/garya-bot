// AGENT NOTE:
// RepoMaintenanceAgent service skeleton.
// Purpose: coordinate deterministic after-change maintenance reporting from provided input only.
// Do not connect this service to Telegram, GitHub runtime, DB, AI, Render, or external tools yet.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { buildRepoMaintenanceReport } from "./RepoMaintenanceReportBuilder.js";

export class RepoMaintenanceAgentService {
  constructor({ agentName = "repo-maintenance-agent" } = {}) {
    this.agentName = agentName;
  }

  analyze(input = {}) {
    try {
      const report = buildRepoMaintenanceReport(input);

      return createAgentResult({
        agent: this.agentName,
        capability: "repo_maintenance_report_only",
        data: {
          report,
        },
        warnings: [
          "RepoMaintenanceAgent V1 uses only provided changed-file input. It does not inspect GitHub/runtime by itself.",
        ],
        metadata: {
          mode: "skeleton_v1",
          connectedToRuntime: false,
          connectedToAI: false,
          connectedToDatabase: false,
          connectedToRender: false,
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

export default RepoMaintenanceAgentService;
