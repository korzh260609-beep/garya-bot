// AGENT NOTE:
// SG 2.0 workspace report/action type registry skeleton.
// Purpose: keep workspace command/report names explicit and allowlisted.
// Do not add runtime execution, file IO, Render API calls, AI calls, DB writes, or Telegram logic here.

export const WORKSPACE_REPORT_TYPES = Object.freeze({
  renderDeploys: "render_deploys",
  renderDeploy: "render_deploy",
  renderLogs: "render_logs",
  renderStatus: "render_status",
});

export const WORKSPACE_COMMAND_ACTIONS = Object.freeze({
  none: "NONE",
  collectRenderDeploys: "COLLECT_RENDER_DEPLOYS",
  collectRenderDeploy: "COLLECT_RENDER_DEPLOY",
  collectRenderLogs: "COLLECT_RENDER_LOGS",
  collectRenderStatus: "COLLECT_RENDER_STATUS",
});

export const WORKSPACE_ACTION_TO_REPORT_TYPE = Object.freeze({
  [WORKSPACE_COMMAND_ACTIONS.collectRenderDeploys]: WORKSPACE_REPORT_TYPES.renderDeploys,
  [WORKSPACE_COMMAND_ACTIONS.collectRenderDeploy]: WORKSPACE_REPORT_TYPES.renderDeploy,
  [WORKSPACE_COMMAND_ACTIONS.collectRenderLogs]: WORKSPACE_REPORT_TYPES.renderLogs,
  [WORKSPACE_COMMAND_ACTIONS.collectRenderStatus]: WORKSPACE_REPORT_TYPES.renderStatus,
});

export function isWorkspaceCommandActionAllowed(action) {
  return Object.values(WORKSPACE_COMMAND_ACTIONS).includes(String(action || ""));
}

export function getWorkspaceReportTypeForAction(action) {
  return WORKSPACE_ACTION_TO_REPORT_TYPE[String(action || "")] || null;
}

export default {
  WORKSPACE_REPORT_TYPES,
  WORKSPACE_COMMAND_ACTIONS,
  WORKSPACE_ACTION_TO_REPORT_TYPE,
  isWorkspaceCommandActionAllowed,
  getWorkspaceReportTypeForAction,
};
