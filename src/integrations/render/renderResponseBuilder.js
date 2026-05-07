// AGENT NOTE:
// SG 2.0 Render response builder.
// Purpose: build compact safe response objects for Render diagnostic requests.
// Do not write GitHub files, send Telegram messages, or expose env values here.

import { sanitizeRenderLogs } from "./renderSanitizer.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildRenderBaseResponse({ request = {}, ok = true, type = "" } = {}) {
  return {
    ok,
    request_id: normalizeString(request.request_id || request.requestId || ""),
    type: normalizeString(type || request.type || ""),
    target: normalizeString(request.target || "garya-bot"),
    generated_at: nowIso(),
    source: "render_bridge",
    secrets_policy: "env_values_never_exposed",
  };
}

export function buildRenderErrorResponse({ request = {}, error, type = "" } = {}) {
  return {
    ...buildRenderBaseResponse({ request, ok: false, type }),
    error: {
      message: normalizeString(error?.message || error || "unknown_error"),
    },
  };
}

export function buildRenderEnvSummaryResponse({ request = {}, diag = {} } = {}) {
  return {
    ...buildRenderBaseResponse({ request, type: "render_env_summary" }),
    env: diag.env || {},
    ready: Boolean(diag.ready),
    enabled: Boolean(diag.enabled),
    has_api_key: Boolean(diag.hasApiKey),
  };
}

export function buildRenderStatusResponse({ request = {}, diag = {}, services = [], deploys = [] } = {}) {
  const latest = deploys[0] || null;

  return {
    ...buildRenderBaseResponse({ request, type: "render_status" }),
    bridge: {
      ready: Boolean(diag.ready),
      enabled: Boolean(diag.enabled),
      has_api_key: Boolean(diag.hasApiKey),
      api_base_url: diag.apiBaseUrl || "",
      timeout_ms: diag.timeoutMs || null,
      default_log_level: diag.defaultLogLevel || "",
      default_log_limit: diag.defaultLogLimit || null,
      default_deploy_limit: diag.defaultDeployLimit || null,
    },
    services: services.map((service) => ({
      id: service.id || "",
      name: service.name || "",
      slug: service.slug || "",
      ownerId: service.ownerId || "",
      type: service.type || "",
      suspended: service.suspended === true,
    })),
    latest_deploy: latest
      ? {
          id: latest.id || "",
          status: latest.status || "unknown",
          commit: latest.commit || "",
          createdAt: latest.createdAt || "",
          finishedAt: latest.finishedAt || "",
        }
      : null,
  };
}

export function buildRenderDeploysResponse({ request = {}, service = null, deploys = [] } = {}) {
  return {
    ...buildRenderBaseResponse({ request, type: "render_deploys" }),
    service: service
      ? {
          id: service.id || "",
          name: service.name || "",
          slug: service.slug || "",
          ownerId: service.ownerId || "",
        }
      : null,
    deploys: deploys.map((deploy) => ({
      id: deploy.id || "",
      status: deploy.status || "unknown",
      commit: deploy.commit || "",
      createdAt: deploy.createdAt || "",
      finishedAt: deploy.finishedAt || "",
    })),
  };
}

export function buildRenderLogsResponse({ request = {}, service = null, logs = [], meta = {} } = {}) {
  return {
    ...buildRenderBaseResponse({ request, type: request.type || "render_logs" }),
    service: service
      ? {
          id: service.id || "",
          name: service.name || "",
          slug: service.slug || "",
          ownerId: service.ownerId || "",
        }
      : null,
    query: {
      level: meta.level || request.level || "all",
      limit: Number(meta.limit || request.limit || logs.length || 0),
      target: meta.target || request.target || "garya-bot",
      deploy_id: meta.deployId || request.deploy_id || request.deployId || "",
    },
    logs_count: logs.length,
    logs: sanitizeRenderLogs(logs, {
      maxMessageChars: Number(request.maxLineChars || request.max_line_chars || 1200),
    }),
  };
}

export default {
  buildRenderBaseResponse,
  buildRenderErrorResponse,
  buildRenderEnvSummaryResponse,
  buildRenderStatusResponse,
  buildRenderDeploysResponse,
  buildRenderLogsResponse,
};
