// AGENT NOTE:
// Render collector config skeleton.
// Purpose: define allowed read-only Render fact collection intents and limits.
// Do not call Render API, runtime, Telegram, GitHub, DB, AI, or filesystem here.

export const RENDER_COLLECTOR_ACTIONS = Object.freeze({
  listDeploys: "list_deploys",
  getDeploy: "get_deploy",
  getLatestLogs: "get_latest_logs",
  getDeployLogs: "get_deploy_logs",
  getStatus: "get_status",
});

export const RENDER_COLLECTOR_LIMITS = Object.freeze({
  defaultLogsLimit: 100,
  maxLogsLimit: 1000,
  defaultDeploysLimit: 20,
  maxDeploysLimit: 100,
});

export const RENDER_COLLECTOR_SAFETY = Object.freeze({
  readOnly: true,
  canChangeState: false,
  tokensSpent: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  mutatesRender: false,
  analyzesLogs: false,
});

export function isRenderCollectorActionAllowed(action) {
  return Object.values(RENDER_COLLECTOR_ACTIONS).includes(String(action || ""));
}

export function clampRenderLogsLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return RENDER_COLLECTOR_LIMITS.defaultLogsLimit;
  return Math.max(1, Math.min(RENDER_COLLECTOR_LIMITS.maxLogsLimit, Math.trunc(n)));
}

export function clampRenderDeploysLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return RENDER_COLLECTOR_LIMITS.defaultDeploysLimit;
  return Math.max(1, Math.min(RENDER_COLLECTOR_LIMITS.maxDeploysLimit, Math.trunc(n)));
}

export default {
  RENDER_COLLECTOR_ACTIONS,
  RENDER_COLLECTOR_LIMITS,
  RENDER_COLLECTOR_SAFETY,
  isRenderCollectorActionAllowed,
  clampRenderLogsLimit,
  clampRenderDeploysLimit,
};
