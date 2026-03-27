// src/integrations/render/RenderBridge.js

import fetch from "node-fetch";
import {
  getRenderBridgeConfig,
  getRenderBridgeDiag,
} from "./RenderBridgeConfig.js";
import {
  normalizeServices,
  normalizeDeploys,
  normalizeLogs,
  filterLogsForService,
  filterLogsByLevel,
  sortLogsNewestFirst,
} from "./RenderBridgeNormalizer.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    if (value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

class RenderBridge {
  constructor() {
    this.config = getRenderBridgeConfig();
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
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

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
            typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)
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

    const exactId = services.find((s) => s.id === rawSelection);
    if (exactId) {
      return { ok: true, service: exactId };
    }

    const lower = rawSelection.toLowerCase();

    const exactSlug = services.find(
      (s) => normalizeString(s.slug).toLowerCase() === lower
    );
    if (exactSlug) {
      return { ok: true, service: exactSlug };
    }

    const exactName = services.find(
      (s) => normalizeString(s.name).toLowerCase() === lower
    );
    if (exactName) {
      return { ok: true, service: exactName };
    }

    if (services.length === 1) {
      return { ok: true, service: services[0] };
    }

    if (!services.length) {
      return { ok: false, error: "service_not_found", matches: [] };
    }

    return {
      ok: false,
      error: "service_ambiguous",
      matches: services.slice(0, 10),
    };
  }

  async listDeploys({ serviceId, limit } = {}) {
    const raw = await this.request(`/services/${encodeURIComponent(serviceId)}/deploys`);
    const items = normalizeDeploys(raw);
    const n = Math.max(1, Math.min(Number(limit) || this.config.defaultDeployLimit, 20));
    return items.slice(0, n);
  }

  async getDeploy({ serviceId, deployId }) {
    const raw = await this.request(
      `/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`
    );

    const items = normalizeDeploys(raw);
    if (items.length) return items[0];

    if (raw && typeof raw === "object") {
      return {
        id:
          normalizeString(raw.id) ||
          normalizeString(raw.deployId) ||
          deployId,
        status:
          normalizeString(raw.status) ||
          normalizeString(raw.state) ||
          "unknown",
        createdAt: normalizeString(raw.createdAt),
        finishedAt:
          normalizeString(raw.finishedAt) ||
          normalizeString(raw.updatedAt),
        commit:
          normalizeString(raw.commit?.id) ||
          normalizeString(raw.commitId) ||
          normalizeString(raw.commit?.sha),
      };
    }

    return {
      id: deployId,
      status: "unknown",
      createdAt: "",
      finishedAt: "",
      commit: "",
    };
  }

  async listRecentLogs({
    serviceId,
    level,
    minutes,
    limit,
  } = {}) {
    const windowMinutes =
      Math.max(1, Math.min(Number(minutes) || this.config.defaultLogWindowMinutes, 1440));
    const maxItems =
      Math.max(1, Math.min(Number(limit) || this.config.defaultLogLimit, 500));
    const requestedLevel = normalizeString(level || this.config.defaultLogLevel);

    const end = new Date();
    const start = new Date(Date.now() - windowMinutes * 60 * 1000);

    const raw = await this.request("/logs", {
      query: {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    let items = normalizeLogs(raw);
    items = filterLogsForService(items, serviceId);
    items = filterLogsByLevel(items, requestedLevel);
    items = sortLogsNewestFirst(items).slice(0, maxItems);

    return items;
  }
}

export const renderBridge = new RenderBridge();

export default renderBridge;