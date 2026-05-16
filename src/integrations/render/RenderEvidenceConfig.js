// src/integrations/render/RenderEvidenceConfig.js
// SG 2.0 — Render Evidence Bridge config.
// Purpose: configure sanitized Render deploy/log evidence collection.
// This module never exposes secrets and never writes Project Memory by itself.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback, min = 1, max = 10_000) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function getRenderEvidenceConfig(env = process.env) {
  const enabled = envBool("RENDER_EVIDENCE_ENABLED", false);
  const apiKey = normalizeString(env.RENDER_API_KEY || "");
  const apiBaseUrl =
    normalizeString(env.RENDER_API_BASE_URL || "") || "https://api.render.com/v1";
  const serviceId = normalizeString(env.RENDER_SERVICE_ID || env.RENDER_EVIDENCE_SERVICE_ID || "");
  const ownerId = normalizeString(env.RENDER_OWNER_ID || env.RENDER_EVIDENCE_OWNER_ID || "");

  return {
    enabled,
    apiKey,
    apiBaseUrl,
    serviceId,
    ownerId,
    timeoutMs: envInt("RENDER_EVIDENCE_TIMEOUT_MS", 20_000, 1_000, 120_000),
    defaultDeployLimit: envInt("RENDER_EVIDENCE_DEPLOY_LIMIT", 5, 1, 20),
    defaultLogLimit: envInt("RENDER_EVIDENCE_LOG_LIMIT", 100, 1, 500),
    defaultLogWindowMinutes: envInt("RENDER_EVIDENCE_LOG_WINDOW_MINUTES", 60, 1, 1440),
    defaultLogLevel: normalizeString(env.RENDER_EVIDENCE_LOG_LEVEL || "") || "error",
    ready: Boolean(enabled && apiKey && serviceId),
  };
}

export function getRenderEvidenceDiag(env = process.env) {
  const config = getRenderEvidenceConfig(env);

  return {
    enabled: config.enabled,
    ready: config.ready,
    hasApiKey: Boolean(config.apiKey),
    hasServiceId: Boolean(config.serviceId),
    hasOwnerId: Boolean(config.ownerId),
    apiBaseUrl: config.apiBaseUrl,
    timeoutMs: config.timeoutMs,
    defaultDeployLimit: config.defaultDeployLimit,
    defaultLogLimit: config.defaultLogLimit,
    defaultLogWindowMinutes: config.defaultLogWindowMinutes,
    defaultLogLevel: config.defaultLogLevel,
  };
}

export default {
  getRenderEvidenceConfig,
  getRenderEvidenceDiag,
};
