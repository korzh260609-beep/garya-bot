// AGENT NOTE:
// RenderLogsCollector service skeleton.
// Purpose: convert already-collected Render facts into workspace-ready reports.
// Do not call Render API, Telegram, AI, DB, GitHub, or external tools here yet.
// Do not analyze logs or diagnose errors.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { buildWorkspacePath } from "../../shared/workspace/WorkspaceFileAllowlist.js";
import { setLatestWorkspaceResult } from "../../shared/workspace/WorkspaceResultStore.js";
import {
  buildRenderDeployReport,
  buildRenderDeploysReport,
  buildRenderLogsReport,
  buildRenderStatusReport,
} from "./RenderLogsReportBuilder.js";

const REPORT_BY_TYPE = Object.freeze({
  render_deploys: {
    fileName: "RENDER_DEPLOYS_REPORT.md",
    builder: ({ data, metadata }) => buildRenderDeploysReport({ deploys: data.deploys, metadata }),
  },
  render_deploy: {
    fileName: "RENDER_DEPLOY_REPORT.md",
    builder: ({ data, metadata }) => buildRenderDeployReport({ deploy: data.deploy, metadata }),
  },
  render_logs: {
    fileName: "RENDER_LOGS_REPORT.md",
    builder: ({ data, metadata }) => buildRenderLogsReport({ logs: data.logs, metadata }),
  },
  render_status: {
    fileName: "RENDER_STATUS_REPORT.md",
    builder: ({ data, metadata }) => buildRenderStatusReport({ status: data.status, metadata }),
  },
});

export class RenderLogsCollectorService {
  constructor({ agentName = "render-logs-collector" } = {}) {
    this.agentName = agentName;
  }

  buildWorkspaceReport({ type, data = {}, metadata = {} } = {}) {
    try {
      const config = REPORT_BY_TYPE[type];

      if (!config) {
        return createAgentErrorResult({
          agent: this.agentName,
          error: `render_collector_report_type_not_allowed:${type || "empty"}`,
          metadata: {
            allowedTypes: Object.keys(REPORT_BY_TYPE),
          },
        });
      }

      const workspacePath = buildWorkspacePath(config.fileName);
      const content = config.builder({ data, metadata });
      const latestResult = setLatestWorkspaceResult({
        type,
        fileName: config.fileName,
        workspacePath,
        collectedAt: metadata.collectedAt || new Date().toISOString(),
        metadata: {
          ...metadata,
          analysis: "none",
        },
      });

      return createAgentResult({
        agent: this.agentName,
        capability: "render_fact_collection_report_builder",
        data: {
          type,
          fileName: config.fileName,
          workspacePath,
          content,
          latestResult,
        },
        warnings: [
          "RenderLogsCollector skeleton formats provided facts only. It does not call Render API by itself yet.",
          "Report content is factual output only. Analysis is intentionally none.",
        ],
        metadata: {
          mode: "skeleton_v1",
          connectedToRuntime: false,
          connectedToAI: false,
          connectedToRender: false,
          canWriteWorkspace: false,
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

export default RenderLogsCollectorService;
