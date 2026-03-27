// src/integrations/render/RenderBridgeConfig.js

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
  };
}

export default {
  getRenderBridgeConfig,
  getRenderBridgeDiag,
};