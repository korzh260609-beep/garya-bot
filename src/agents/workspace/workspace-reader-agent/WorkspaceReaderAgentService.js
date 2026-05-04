// AGENT NOTE:
// WorkspaceReaderAgent service skeleton.
// Purpose: wrap shared WorkspaceReader as a real agent boundary.
// Do not connect this service to Telegram, runtime, Render, GitHub, DB, AI, or filesystem.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { WorkspaceReader } from "../../shared/workspace/WorkspaceReader.js";

export class WorkspaceReaderAgentService {
  constructor({ agentName = "workspace-reader-agent", reader = new WorkspaceReader() } = {}) {
    this.agentName = agentName;
    this.reader = reader;
  }

  readProvidedWorkspaceFile(input = {}) {
    try {
      const readResult = this.reader.readProvidedFile(input);

      return createAgentResult({
        agent: this.agentName,
        capability: "workspace_read_provided_content_agent",
        data: {
          readResult,
        },
        warnings: [
          "WorkspaceReaderAgent skeleton reads only provided input. It does not read files by itself.",
        ],
        metadata: {
          mode: "workspace_reader_agent_skeleton_v1",
          connectedToRuntime: false,
          connectedToTelegram: false,
          connectedToRender: false,
          connectedToGitHub: false,
          connectedToDatabase: false,
          connectedToAI: false,
          readsFilesystem: false,
          writesFilesystem: false,
          executesWorkspaceAction: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "workspace_reader_agent_skeleton_v1",
        },
      });
    }
  }

  parseProvidedWorkspaceCommand(input = {}) {
    try {
      const parsedResult = this.reader.parseProvidedCommand(input);

      return createAgentResult({
        agent: this.agentName,
        capability: "workspace_parse_provided_command_agent",
        data: {
          parsedResult,
        },
        warnings: [
          "WorkspaceReaderAgent skeleton parses provided text only. It does not execute workspace actions.",
        ],
        metadata: {
          mode: "workspace_reader_agent_skeleton_v1",
          connectedToRuntime: false,
          connectedToTelegram: false,
          connectedToRender: false,
          connectedToGitHub: false,
          connectedToDatabase: false,
          connectedToAI: false,
          readsFilesystem: false,
          writesFilesystem: false,
          executesWorkspaceAction: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "workspace_reader_agent_skeleton_v1",
        },
      });
    }
  }
}

export default WorkspaceReaderAgentService;
