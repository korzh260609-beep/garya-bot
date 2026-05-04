// AGENT NOTE:
// SG 2.0 workspace file allowlist.
// Purpose: constrain collector outputs to known repo workspace markdown reports.
// Do not allow arbitrary paths, source files, pillars, env files, or code writes here.

export const WORKSPACE_BASE_PATH = "agent_workspace";

export const WORKSPACE_ALLOWED_FILES = Object.freeze([
  "README.md",
  "COMMANDS.md",
  "RENDER_DEPLOYS_REPORT.md",
  "RENDER_DEPLOY_REPORT.md",
  "RENDER_LOGS_REPORT.md",
  "RENDER_STATUS_REPORT.md",
]);

export function isWorkspaceFileAllowed(fileName) {
  return WORKSPACE_ALLOWED_FILES.includes(String(fileName || ""));
}

export function buildWorkspacePath(fileName) {
  const safeFileName = String(fileName || "").trim();

  if (!isWorkspaceFileAllowed(safeFileName)) {
    throw new Error(`workspace_file_not_allowed:${safeFileName || "empty"}`);
  }

  return `${WORKSPACE_BASE_PATH}/${safeFileName}`;
}

export default {
  WORKSPACE_BASE_PATH,
  WORKSPACE_ALLOWED_FILES,
  isWorkspaceFileAllowed,
  buildWorkspacePath,
};
