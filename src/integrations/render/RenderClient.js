// AGENT NOTE:
// SG 2.0 Render client read-only integration.
// Purpose: provide bounded read-only Render API access for diagnostics agents.
// Do not perform Render write/deploy actions here.

import { getRenderConfig, getRenderConfigForDiagnostics } from "./RenderConfig.js";
import {
  normalizeRenderDeploy,
  normalizeRenderDeploys,
  normalizeRenderLogs,
  normalizeRenderServices,
} from "./RenderNormalizer.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function getInternalRenderToken() {
  const envName = ["RENDER", "API", "KEY"].join("_");
  return normalizeString(process.env[envName] || "");
}

function redactInput(input = {}) {
  if (!input || typeof input !== "object") return {};

  const redacted = { ...input };
  delete redacted.apiKey;
  delete redacted.token;
  delete redacted.authorization;
  delete redacted.Authorization;
  return redacted;
}

function buildSkippedResult({ operation, reason, input = {}, diagnostics = {} } = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    operation,
    input: redactInput(input),
    diagnostics,
    renderReads: false,
  };
}

function buildFailureResult({ operation, reason, input = {}, status = null, detail = "" } = {}) {
  return {
    ok: false,
    skipped: false,
    reason,
    operation,
    input: redactInput(input),
    status,
    detail: normalizeString(detail).slice(0, 500),
    renderReads: true,
  };
}

function buildSuccessResult({ operation, input = {}, data, meta = {} } = {}) {
  return {
    ok: true,
    skipped: false,
    reason: "ok",
    operation,
    input: redactInput(input),
    data,
    meta,
    renderReads: true,
  };
}

function toQueryString(query = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

function joinUrl(baseUrl, path) {
  const safeBase = normalizeString(baseUrl).replace(/\/+$/, "");
  const safePath = normalizeString(path).replace(/^\/+/, "");
  return `${safeBase}/${safePath}`;
}

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export class RenderClient {
  constructor({ config = getRenderConfig(), tokenProvider = getInternalRenderToken } = {}) {
    this.config = config;
    this.tokenProvider = tokenProvider;
  }

  getDiagnostics() {
    return getRenderConfigForDiagnostics();
  }

  getReadyState(input = {}) {
    const diagnostics = this.getDiagnostics();
    const token = this.tokenProvider();

    if (!this.config.enabled) {
      return {
        ok: false,
        result: buildSkippedResult({
          operation: input.operation,
          reason: "render_integration_disabled",
          input,
          diagnostics,
        }),
      };
    }

    if (!token) {
      return {
        ok: false,
        result: buildSkippedResult({
          operation: input.operation,
          reason: "render_api_token_missing",
          input,
          diagnostics,
        }),
      };
    }

    if (!globalThis.fetch || !globalThis.AbortController) {
      return {
        ok: false,
        result: buildSkippedResult({
          operation: input.operation,
          reason: "fetch_runtime_unavailable",
          input,
          diagnostics,
        }),
      };
    }

    return { ok: true, token };
  }

  resolveServiceId(input = {}) {
    return normalizeString(input.serviceId || input.service_id || this.config.defaultServiceId);
  }

  async requestJson({ operation, path, query = {}, input = {} } = {}) {
    const ready = this.getReadyState({ ...input, operation });
    if (!ready.ok) return ready.result;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = `${joinUrl(this.config.apiBaseUrl, path)}${toQueryString(query)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${ready.token}`,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let json = null;

      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (!response.ok) {
        return buildFailureResult({
          operation,
          reason: "render_api_http_error",
          input,
          status: response.status,
          detail: json?.message || json?.error || text,
        });
      }

      return buildSuccessResult({
        operation,
        input,
        data: json,
        meta: {
          status: response.status,
        },
      });
    } catch (error) {
      return buildFailureResult({
        operation,
        reason: error?.name === "AbortError" ? "render_api_timeout" : "render_api_request_failed",
        input,
        detail: error?.message,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async listServices(input = {}) {
    const operation = "list_services";
    const raw = await this.requestJson({
      operation,
      path: "/services",
      input,
    });

    if (!raw.ok) return raw;

    return buildSuccessResult({
      operation,
      input,
      data: normalizeRenderServices(raw.data),
      meta: raw.meta,
    });
  }

  async listDeploys(input = {}) {
    const operation = "list_deploys";
    const serviceId = this.resolveServiceId(input);

    if (!serviceId) {
      return buildSkippedResult({
        operation,
        reason: "render_service_id_missing",
        input,
        diagnostics: this.getDiagnostics(),
      });
    }

    const limit = clampInt(input.limit, this.config.defaultDeployLimit, 1, 50);
    const raw = await this.requestJson({
      operation,
      path: `/services/${encodeURIComponent(serviceId)}/deploys`,
      query: { limit },
      input: { ...input, serviceId, limit },
    });

    if (!raw.ok) return raw;

    return buildSuccessResult({
      operation,
      input: { ...input, serviceId, limit },
      data: normalizeRenderDeploys(raw.data),
      meta: raw.meta,
    });
  }

  async getDeploy(input = {}) {
    const operation = "get_deploy";
    const serviceId = this.resolveServiceId(input);
    const deployId = normalizeString(input.deployId || input.deploy_id);

    if (!serviceId) {
      return buildSkippedResult({
        operation,
        reason: "render_service_id_missing",
        input,
        diagnostics: this.getDiagnostics(),
      });
    }

    if (!deployId) {
      return buildSkippedResult({
        operation,
        reason: "render_deploy_id_missing",
        input: { ...input, serviceId },
        diagnostics: this.getDiagnostics(),
      });
    }

    const raw = await this.requestJson({
      operation,
      path: `/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`,
      input: { ...input, serviceId, deployId },
    });

    if (!raw.ok) return raw;

    return buildSuccessResult({
      operation,
      input: { ...input, serviceId, deployId },
      data: normalizeRenderDeploy(raw.data),
      meta: raw.meta,
    });
  }

  async listLogs(input = {}) {
    const operation = "list_logs";
    const serviceId = this.resolveServiceId(input);

    if (!serviceId) {
      return buildSkippedResult({
        operation,
        reason: "render_service_id_missing",
        input,
        diagnostics: this.getDiagnostics(),
      });
    }

    const limit = clampInt(input.limit, this.config.defaultLogLimit, 1, 500);
    const windowMinutes = clampInt(input.windowMinutes, this.config.defaultLogWindowMinutes, 1, 1440);
    const endTime = normalizeString(input.endTime) || new Date().toISOString();
    const startTime = normalizeString(input.startTime) || minutesAgoIso(windowMinutes);

    const raw = await this.requestJson({
      operation,
      path: "/logs",
      query: {
        resource: serviceId,
        startTime,
        endTime,
        limit,
      },
      input: { ...input, serviceId, startTime, endTime, limit },
    });

    if (!raw.ok) return raw;

    return buildSuccessResult({
      operation,
      input: { ...input, serviceId, startTime, endTime, limit },
      data: normalizeRenderLogs(raw.data),
      meta: raw.meta,
    });
  }
}

export const renderClient = new RenderClient();

export default RenderClient;
