// AGENT NOTE:
// WorkspaceWriterAgent service skeleton.
// Purpose: wrap shared WorkspaceWriter as a real agent boundary.
// Do not connect this service to Telegram, runtime, Render, GitHub, DB, AI, or filesystem.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { WorkspaceWriter } from "../../shared/workspace/WorkspaceWriter.js";

export class WorkspaceWriterAgentService {
  constructor({ agentName = "workspace-writer-agent", writer = new WorkspaceWriter() } = {}) {
    this.agentName = agentName;
    this.writer = writer;
  }

  buildWorkspaceWritePlan(input = {}) {
    try {
      const writePlan = this.writer.buildWritePlan(input);

      return createAgentResult({
        agent: this.agentName,
        capability: "workspace_write_plan_agent",
        data: {
          writePlan,
        },
        warnings: [
          "WorkspaceWriterAgent skeleton builds a write plan only. It does not write files by itself.",
        ],
        metadata: {
          mode: "workspace_writer_agent_skeleton_v1",
          connectedToRuntime: false,
          connectedToTelegram: false,
          connectedToRender: false,
          connectedToGitHub: false,
          connectedToDatabase: false,
          connectedToAI: false,
          readsFilesystem: false,
          writesFilesystem: false,
          writesRepository: false,
          executesWorkspaceAction: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "workspace_writer_agent_skeleton_v1",
        },
      });
    }
  }
}

export default WorkspaceWriterAgentService;
