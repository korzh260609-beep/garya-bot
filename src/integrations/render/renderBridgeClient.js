// AGENT NOTE:
// SG 2.0 Render Bridge client.
// Purpose: read Render service, deploy, and log data through existing Render env configuration.
// Do not mutate Render state, deploy, restart, or update environment variables here.

import {
  getRenderBridgeConfig,
  getRenderBridgeDiag,
} from "./renderBridgeConfig.js";
import {
  normalizeServices,
  normalizeDeploys,
  normalizeLogs,
  filterLogsForService,
  filterLogsByLevel,
  sortLogsNewestFirst,
} from "./renderBridgeNormalizer.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value, fallback, min = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(min, Math.trunc(Number(fallback) || min));
  return Math.max(min, Math.trunc(n));
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === null || entry === undefined || String(entry) === "") continue;
        url.searchParams.append(key, String(entry));
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function validIsoOrEmpty(value) {
  const text = normalizeString(value);
  if (!text) return "";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

function normalizeLogItems(raw, { serviceId, level, limit, fallbackLimit = 100 } = {}) {
  const normalizedServiceId = normalizeString(serviceId);
  const maxItems = positiveInt(limit, fallbackLimit, 1);
  const requestedLevel = normalizeString(level || "all");

  let items = normalizeLogs(raw);
  items = filterLogsForService(items, normalizedServiceId);
  items = filterLogsByLevel(items, requestedLevel);
  items = sortLogsNewestFirst(items).slice(0, maxItems);

  return items;
}

export class RenderBridgeClient {
  constructor({ config } = {}) {
    this.config = config || getRenderBridgeConfig();
  }

  getDiag() {
    return getRenderBridgeDiag();
  }

  ensureReady() {
    if (!this.config.enabled) {
      throw new Error("render_bridge_disabled");
    }

    if (!this.config.apiKey) {
      throw new Error("render_api_key_missing");
    }
  }

  async request(path, { method = "GET", query = {}, body = null } = {}) {
    this.ensureReady();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const url = buildUrl(this.config.apiBaseUrl, path, query);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      if (!response.ok) {
        throw new Error(
          `render_api_http_${response.status}: ${
            typeof parsed === "string"
              ? parsed.slice(0, 500)
              : JSON.stringify(parsed).slice(0, 500)
          }`
        );
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listServices({ filter = "" } = {}) {
    const raw = await this.request("/services");
    let items = normalizeServices(raw);

    const q = normalizeString(filter).toLowerCase();
    if (q) {
      items = items.filter((item) => {
        return (
          normalizeString(item.id).toLowerCase().includes(q) ||
          normalizeString(item.ownerId).toLowerCase().includes(q) ||
          normalizeString(item.name).toLowerCase().includes(q) ||
          normalizeString(item.slug).toLowerCase().includes(q) ||
          normalizeString(item.type).toLowerCase().includes(q)
        );
      });
    }

    return items;
  }

  async resolveService(selection) {
    const rawSelection = normalizeString(selection);
    if (!rawSelection) {
      return {
        ok: false,
        error: "missing_service_selection",
      };
    }

    const services = await this.listServices({ filter: rawSelection });
    const exactId = services.find((service) => service.id === rawSelection);
    if (exactId) return { ok: true, service: exactId };

    const lower = rawSelection.toLowerCase();
    const exactSlug = services.find((service) => normalizeString(service.slug).toLowerCase() === lower);
    if (exactSlug) return { ok: true, service: exactSlug };

    const exactName = services.find((service) => normalizeString(service.name).toLowerCase() === lower);
    if (exactName) return { ok: true, service: exactName };

    if (services.length === 1) return { ok: true, service: services[0] };
    if (!services.length) return { ok: false, error: "service_not_found", matches: [] };

    return {
      ok: false,
      error: "service_ambiguous",
      matches: services.slice(0, 10),
    };
  }

  async listDeploys({ serviceId, limit } = {}) {
    const normalizedServiceId = normalizeString(serviceId);
    if (!normalizedServiceId) throw new Error("render_service_id_missing");

    const raw = await this.request(`/services/${encodeURIComponent(normalizedServiceId)}/deploys`);
    const items = normalizeDeploys(raw);
    const n = Math.max(1, Math.min(Number(limit) || this.config.defaultDeployLimit, 20));

    return items.slice(0, n);
  }

  async getDeploy({ serviceId, deployId }) {
    const normalizedServiceId = normalizeString(serviceId);
    const normalizedDeployId = normalizeString(deployId);

    if (!normalizedServiceId) throw new Error("render_service_id_missing");
    if (!normalizedDeployId) throw new Error("render_deploy_id_missing");

    const raw = await this.request(
      `/services/${encodeURIComponent(normalizedServiceId)}/deploys/${encodeURIComponent(normalizedDeployId)}`
    );

    const items = normalizeDeploys(raw);
    if (items.length) return items[0];

    return {
      id: normalizedDeployId,
      status: "unknown",
      createdAt: "",
      finishedAt: "",
      commit: "",
    };
  }

  async requestLogsWithFallbacks({ ownerId, serviceId, startTime, endTime, limit }) {
    const attempts = [
      { label: "resource", query: { ownerId, resource: serviceId, startTime, endTime, limit } },
      { label: "resources[]", query: { ownerId, resources: [serviceId], startTime, endTime, limit } },
      { label: "resourceId", query: { ownerId, resourceId: serviceId, startTime, endTime, limit } },
      { label: "resourceIds[]", query: { ownerId, resourceIds: [serviceId], startTime, endTime, limit } },
      { label: "serviceId", query: { ownerId, serviceId, startTime, endTime, limit } },
      { label: "filters[resource]", query: { ownerId, "filters[resource]": serviceId, startTime, endTime, limit } },
      { label: "filters[resources][]", query: { ownerId, "filters[resources]": [serviceId], startTime, endTime, limit } },
      { label: "filters[resourceId]", query: { ownerId, "filters[resourceId]": serviceId, startTime, endTime, limit } },
      { label: "filters[resourceIds][]", query: { ownerId, "filters[resourceIds]": [serviceId], startTime, endTime, limit } },
    ];

    let lastError = null;
    const diagnostics = [];

    for (const attempt of attempts) {
      try {
        return await this.request("/logs", { query: attempt.query });
      } catch (error) {
        lastError = error;
        const msg = String(error?.message || "");
        diagnostics.push(`${attempt.label}: ${msg}`);

        const isFilterError =
          msg.includes("must specify at least one resource in filters") ||
          msg.includes("ownerId is required") ||
          msg.includes("render_api_http_400");

        if (!isFilterError) throw error;
      }
    }

    const suffix = diagnostics.length ? ` | attempts=${diagnostics.join(" || ")}` : "";
    throw new Error(`${lastError?.message || "render_logs_request_failed"}${suffix}`);
  }

  async listLogsByCount({ ownerId, serviceId, level = "all", limit } = {}) {
    const normalizedOwnerId = normalizeString(ownerId);
    const normalizedServiceId = normalizeString(serviceId);

    if (!normalizedOwnerId) throw new Error("render_owner_id_missing");
    if (!normalizedServiceId) throw new Error("render_service_id_missing");

    const maxItems = positiveInt(limit, this.config.defaultLogLimit, 1);
    const raw = await this.requestLogsWithFallbacks({
      ownerId: normalizedOwnerId,
      serviceId: normalizedServiceId,
      limit: maxItems,
    });

    return normalizeLogItems(raw, {
      serviceId: normalizedServiceId,
      level,
      limit: maxItems,
      fallbackLimit: this.config.defaultLogLimit,
    });
  }

  async listRecentLogs({ ownerId, serviceId, level, minutes, limit, startTime = "", endTime = "" } = {}) {
    const normalizedOwnerId = normalizeString(ownerId);
    const normalizedServiceId = normalizeString(serviceId);

    if (!normalizedOwnerId) throw new Error("render_owner_id_missing");
    if (!normalizedServiceId) throw new Error("render_service_id_missing");

    const windowMinutes = Math.max(1, Math.min(Number(minutes) || this.config.defaultLogWindowMinutes, 1440));
    const maxItems = positiveInt(limit, this.config.defaultLogLimit, 1);
    const requestedLevel = normalizeString(level || this.config.defaultLogLevel);

    const explicitStartTime = validIsoOrEmpty(startTime);
    const explicitEndTime = validIsoOrEmpty(endTime);
    const end = explicitEndTime ? new Date(explicitEndTime) : new Date();
    const start = explicitStartTime ? new Date(explicitStartTime) : new Date(Date.now() - windowMinutes * 60 * 1000);

    const raw = await this.requestLogsWithFallbacks({
      ownerId: normalizedOwnerId,
      serviceId: normalizedServiceId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      limit: maxItems,
    });

    return normalizeLogItems(raw, {
      serviceId: normalizedServiceId,
      level: requestedLevel,
      limit: maxItems,
      fallbackLimit: this.config.defaultLogLimit,
    });
  }
}

export const renderBridgeClient = new RenderBridgeClient();

export default renderBridgeClient;
