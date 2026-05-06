// AGENT NOTE:
// SG 2.0 Render integration config skeleton.
// Purpose: centralize Render runtime configuration without exposing secrets.
// Do not perform Render API calls here.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback, min, max) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function getRenderConfig() {
  const enabled = envBool("RENDER_INTEGRATION_ENABLED", false);
  const apiKey = normalizeString(process.env.RENDER_API_KEY || "");
  const apiBaseUrl = normalizeString(process.env.RENDER_API_BASE_URL || "") || "https://api.render.com/v1";
  const defaultServiceId = normalizeString(process.env.RENDER_DEFAULT_SERVICE_ID || "");
  const defaultOwnerId = normalizeString(process.env.RENDER_DEFAULT_OWNER_ID || "");

  return {
    enabled,
    apiBaseUrl,
    defaultServiceId,
    defaultOwnerId,
    timeoutMs: envInt("RENDER_API_TIMEOUT_MS", 15000, 1000, 60000),
    defaultLogLimit: envInt("RENDER_DEFAULT_LOG_LIMIT", 100, 1, 500),
    defaultDeployLimit: envInt("RENDER_DEFAULT_DEPLOY_LIMIT", 10, 1, 50),
    defaultLogWindowMinutes: envInt("RENDER_DEFAULT_LOG_WINDOW_MINUTES", 60, 1, 1440),
    hasApiKey: Boolean(apiKey),
    ready: Boolean(enabled && apiKey),
  };
}

export function getRenderConfigForDiagnostics() {
  const config = getRenderConfig();

  return {
    enabled: config.enabled,
    apiBaseUrl: config.apiBaseUrl,
    defaultServiceIdConfigured: Boolean(config.defaultServiceId),
    defaultOwnerIdConfigured: Boolean(config.defaultOwnerId),
    timeoutMs: config.timeoutMs,
    defaultLogLimit: config.defaultLogLimit,
    defaultDeployLimit: config.defaultDeployLimit,
    defaultLogWindowMinutes: config.defaultLogWindowMinutes,
    hasApiKey: config.hasApiKey,
    ready: config.ready,
  };
}

export default {
  getRenderConfig,
  getRenderConfigForDiagnostics,
};
