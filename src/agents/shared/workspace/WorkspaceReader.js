// AGENT NOTE:
// SG 2.0 workspace reader skeleton.
// Purpose: normalize provided workspace file content and parse COMMANDS.md safely.
// This skeleton does not read repo files by itself and does not call GitHub, FS, DB, AI, Render, or Telegram.

import { buildWorkspacePath } from "./WorkspaceFileAllowlist.js";
import { parseWorkspaceCommand } from "./WorkspaceCommandParser.js";

export class WorkspaceReader {
  constructor({ readerName = "workspace-reader" } = {}) {
    this.readerName = readerName;
  }

  readProvidedFile({ fileName, content = "", metadata = {} } = {}) {
    const workspacePath = buildWorkspacePath(fileName);

    return {
      ok: true,
      reader: this.readerName,
      fileName,
      workspacePath,
      content: String(content || ""),
      canChangeState: false,
      tokensSpent: false,
      metadata: {
        ...metadata,
        mode: "workspace_reader_skeleton_v1",
        readsFilesystem: false,
        connectedToGitHub: false,
        connectedToRuntime: false,
        connectedToAI: false,
      },
    };
  }

  parseProvidedCommand({ content = "", metadata = {} } = {}) {
    const parsed = parseWorkspaceCommand(content);

    return {
      ok: parsed.ok,
      reader: this.readerName,
      command: parsed,
      canChangeState: false,
      tokensSpent: false,
      warnings: parsed.warnings,
      metadata: {
        ...metadata,
        mode: "workspace_reader_command_skeleton_v1",
        readsFilesystem: false,
        executesCommand: false,
      },
    };
  }
}

export default WorkspaceReader;
