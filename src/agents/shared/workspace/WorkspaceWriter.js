// AGENT NOTE:
// SG 2.0 workspace writer skeleton.
// Purpose: build an explicit, allowlisted workspace write plan.
// This skeleton does not write files, call GitHub, FS, DB, AI, Render, or Telegram.

import { buildWorkspacePath } from "./WorkspaceFileAllowlist.js";

export class WorkspaceWriter {
  constructor({ writerName = "workspace-writer" } = {}) {
    this.writerName = writerName;
  }

  buildWritePlan({ fileName, content = "", metadata = {} } = {}) {
    const workspacePath = buildWorkspacePath(fileName);

    return {
      ok: true,
      writer: this.writerName,
      operation: "workspace_write_plan",
      fileName,
      workspacePath,
      content: String(content || ""),
      canChangeState: false,
      tokensSpent: false,
      warnings: [
        "WorkspaceWriter skeleton builds a write plan only. It does not write to repo or filesystem.",
      ],
      metadata: {
        ...metadata,
        mode: "workspace_writer_skeleton_v1",
        writesFilesystem: false,
        writesRepository: false,
        connectedToGitHub: false,
        connectedToRuntime: false,
        connectedToAI: false,
        connectedToRender: false,
      },
    };
  }
}

export default WorkspaceWriter;
