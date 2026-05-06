// AGENT NOTE:
// SG 2.0 Render Bridge config.
// Purpose: read existing Render bridge environment variables without creating or exposing secrets.
// Do not log, return, write, or mask actual secret values here.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envInt(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? Math.trunc(raw) : fallback;
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

export function getRenderBridgeConfig() {
  return {
    enabled: envBool("RENDER_BRIDGE_ENABLED", false),
    apiKey: normalizeString(process.env.RENDER_API_KEY || ""),
    apiBaseUrl:
      normalizeString(process.env.RENDER_API_BASE_URL || "") ||
      "https://api.render.com/v1",
    timeoutMs: envInt("RENDER_BRIDGE_TIMEOUT_MS", 20000),
    defaultSourceKey:
      normalizeString(process.env.RENDER_BRIDGE_DEFAULT_SOURCE_KEY || "") ||
      "render_primary",
    defaultLogLevel:
      normalizeString(process.env.RENDER_BRIDGE_DEFAULT_LOG_LEVEL || "") ||
      "error",
    defaultLogWindowMinutes: envInt(
      "RENDER_BRIDGE_DEFAULT_LOG_WINDOW_MINUTES",
      60
    ),
    defaultLogLimit: envInt("RENDER_BRIDGE_DEFAULT_LOG_LIMIT", 100),
    defaultDeployLimit: envInt("RENDER_BRIDGE_DEFAULT_DEPLOY_LIMIT", 5),
  };
}

export function getRenderBridgeEnvSummary() {
  return {
    RENDER_BRIDGE_ENABLED: process.env.RENDER_BRIDGE_ENABLED ? "SET" : "MISSING",
    RENDER_API_KEY: process.env.RENDER_API_KEY ? "SET" : "MISSING",
    RENDER_API_BASE_URL: process.env.RENDER_API_BASE_URL ? "SET" : "MISSING",
    RENDER_BRIDGE_TIMEOUT_MS: process.env.RENDER_BRIDGE_TIMEOUT_MS ? "SET" : "MISSING",
    RENDER_BRIDGE_DEFAULT_SOURCE_KEY: process.env.RENDER_BRIDGE_DEFAULT_SOURCE_KEY ? "SET" : "MISSING",
    RENDER_BRIDGE_DEFAULT_LOG_LEVEL: process.env.RENDER_BRIDGE_DEFAULT_LOG_LEVEL ? "SET" : "MISSING",
    RENDER_BRIDGE_DEFAULT_LOG_WINDOW_MINUTES: process.env.RENDER_BRIDGE_DEFAULT_LOG_WINDOW_MINUTES ? "SET" : "MISSING",
    RENDER_BRIDGE_DEFAULT_LOG_LIMIT: process.env.RENDER_BRIDGE_DEFAULT_LOG_LIMIT ? "SET" : "MISSING",
    RENDER_BRIDGE_DEFAULT_DEPLOY_LIMIT: process.env.RENDER_BRIDGE_DEFAULT_DEPLOY_LIMIT ? "SET" : "MISSING",
  };
}

export function getRenderBridgeDiag() {
  const cfg = getRenderBridgeConfig();

  return {
    enabled: cfg.enabled,
    apiBaseUrl: cfg.apiBaseUrl,
    timeoutMs: cfg.timeoutMs,
    defaultSourceKey: cfg.defaultSourceKey,
    defaultLogLevel: cfg.defaultLogLevel,
    defaultLogWindowMinutes: cfg.defaultLogWindowMinutes,
    defaultLogLimit: cfg.defaultLogLimit,
    defaultDeployLimit: cfg.defaultDeployLimit,
    hasApiKey: Boolean(cfg.apiKey),
    ready: Boolean(cfg.enabled && cfg.apiKey),
    env: getRenderBridgeEnvSummary(),
  };
}

export default {
  getRenderBridgeConfig,
  getRenderBridgeEnvSummary,
  getRenderBridgeDiag,
};
