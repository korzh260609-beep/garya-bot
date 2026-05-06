// AGENT NOTE:
// Agent workspace allowlisted report paths.
// Purpose: keep workspace cleanup/report writes bounded and predictable.
// This skeleton defines paths only; it does not read or write files.

export const AGENT_WORKSPACE_ROOT = "agent_workspace";
export const AGENT_WORKSPACE_RENDER_ROOT = "agent_workspace/render";

export const AGENT_WORKSPACE_COMMAND_FILE = "agent_workspace/COMMANDS.md";

export const AGENT_WORKSPACE_CLEANABLE_REPORT_PATHS = Object.freeze([
  "agent_workspace/STATUS.md",
  "agent_workspace/OUTBOX.md",
  "agent_workspace/render/RENDER_LOGS_REPORT.md",
  "agent_workspace/render/RENDER_DEPLOYS_REPORT.md",
  "agent_workspace/render/RENDER_DEPLOY_REPORT.md",
  "agent_workspace/render/RENDER_STATUS_REPORT.md",
]);

export const AGENT_WORKSPACE_PROTECTED_PATHS = Object.freeze([
  "agent_workspace/README.md",
  "agent_workspace/COMMANDS.md",
  "agent_workspace/render/README.md",
]);

export function isCleanableWorkspaceReportPath(path) {
  return AGENT_WORKSPACE_CLEANABLE_REPORT_PATHS.includes(String(path || ""));
}

export function isProtectedWorkspacePath(path) {
  return AGENT_WORKSPACE_PROTECTED_PATHS.includes(String(path || ""));
}

export default {
  AGENT_WORKSPACE_ROOT,
  AGENT_WORKSPACE_RENDER_ROOT,
  AGENT_WORKSPACE_COMMAND_FILE,
  AGENT_WORKSPACE_CLEANABLE_REPORT_PATHS,
  AGENT_WORKSPACE_PROTECTED_PATHS,
  isCleanableWorkspaceReportPath,
  isProtectedWorkspacePath,
};
