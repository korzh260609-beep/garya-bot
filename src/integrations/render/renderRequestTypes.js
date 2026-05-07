// AGENT NOTE:
// SG 2.0 Render request type boundary.
// Purpose: define the minimal allowlist of Render diagnostic request types.
// Do not add deploy, restart, shell, env update, or mutation request types here.

export const RENDER_REQUEST_TYPES = Object.freeze({
  LOGS: "render_logs",
  DEPLOYS: "render_deploys",
  LATEST_DEPLOY_LOGS: "render_latest_deploy_logs",
  ENV_SUMMARY: "render_env_summary",
  STATUS: "render_status",
});

export const RENDER_ALLOWED_REQUEST_TYPES = Object.freeze(
  Object.values(RENDER_REQUEST_TYPES)
);

export function isRenderRequestTypeAllowed(type) {
  return RENDER_ALLOWED_REQUEST_TYPES.includes(String(type || ""));
}

export default {
  RENDER_REQUEST_TYPES,
  RENDER_ALLOWED_REQUEST_TYPES,
  isRenderRequestTypeAllowed,
};
