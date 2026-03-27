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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const s = normalizeString(value);
    if (s) return s;
  }
  return "";
}

function looksLikeServiceObject(obj) {
  if (!isPlainObject(obj)) return false;

  const score = [
    firstNonEmpty(obj.id),
    firstNonEmpty(obj.name),
    firstNonEmpty(obj.slug),
    firstNonEmpty(obj.type),
    firstNonEmpty(obj.url),
    firstNonEmpty(obj.dashboardUrl),
    firstNonEmpty(obj.serviceId),
  ].filter(Boolean).length;

  return score >= 2;
}

function normalizeServiceCandidate(obj) {
  if (!isPlainObject(obj)) {
    return null;
  }

  const nested =
    (isPlainObject(obj.service) && obj.service) ||
    (isPlainObject(obj.resource) && obj.resource) ||
    (isPlainObject(obj.item) && obj.item) ||
    (isPlainObject(obj.data) && obj.data) ||
    (isPlainObject(obj.result) && obj.result) ||
    obj;

  const item = {
    id: firstNonEmpty(
      nested.id,
      nested.serviceId,
      obj.id,
      obj.serviceId
    ),
    name: firstNonEmpty(
      nested.name,
      nested.serviceName,
      obj.name,
      obj.serviceName
    ),
    slug: firstNonEmpty(
      nested.slug,
      obj.slug
    ),
    type: firstNonEmpty(
      nested.type,
      obj.type
    ),
    region: firstNonEmpty(
      nested.region,
      obj.region
    ),
    url: firstNonEmpty(
      nested.url,
      nested.dashboardUrl,
      nested.serviceDetails?.url,
      obj.url,
      obj.dashboardUrl,
      obj.serviceDetails?.url
    ),
    suspended:
      typeof nested.suspended === "boolean"
        ? nested.suspended
        : typeof obj.suspended === "boolean"
          ? obj.suspended
          : undefined,
  };

  if (!item.id && !item.name && !item.slug) {
    return null;
  }

  return item;
}

function extractServiceCandidatesDeep(node, acc = [], seen = new WeakSet()) {
  if (!node || typeof node !== "object") {
    return acc;
  }

  if (seen.has(node)) {
    return acc;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      extractServiceCandidatesDeep(item, acc, seen);
    }
    return acc;
  }

  if (looksLikeServiceObject(node)) {
    const normalized = normalizeServiceCandidate(node);
    if (normalized) {
      acc.push(normalized);
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      extractServiceCandidatesDeep(value, acc, seen);
    }
  }

  return acc;
}

function dedupeServices(items) {
  const map = new Map();

  for (const item of items) {
    if (!item) continue;

    const key =
      firstNonEmpty(item.id) ||
      `slug:${firstNonEmpty(item.slug)}` ||
      `name:${firstNonEmpty(item.name)}`;

    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const prev = map.get(key);
    map.set(key, {
      id: firstNonEmpty(prev.id, item.id),
      name: firstNonEmpty(prev.name, item.name),
      slug: firstNonEmpty(prev.slug, item.slug),
      type: firstNonEmpty(prev.type, item.type),
      region: firstNonEmpty(prev.region, item.region),
      url: firstNonEmpty(prev.url, item.url),
      suspended:
        typeof prev.suspended === "boolean"
          ? prev.suspended
          : item.suspended,
    });
  }

  return [...map.values()];
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
              ? parsed.slice(0, 300)
              : JSON.stringify(parsed).slice(0, 300)
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

    // fallback: aggressively scan raw payload for service-like objects
    if (!items.length) {
      items = dedupeServices(extractServiceCandidatesDeep(raw));
    }

    // temporary defensive fallback:
    // if still empty but raw itself is a single service-like object
    if (!items.length && isPlainObject(raw)) {
      const one = normalizeServiceCandidate(raw);
      if (one) {
        items = [one];
      }
    }

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
    const raw = await this.request(
      `/services/${encodeURIComponent(serviceId)}/deploys`
    );
    const items = normalizeDeploys(raw);
    const n = Math.max(
      1,
      Math.min(Number(limit) || this.config.defaultDeployLimit, 20)
    );
    return items.slice(0, n);
  }

  async getDeploy({ serviceId, deployId }) {
    const raw = await this.request(
      `/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(
        deployId
      )}`
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
    const windowMinutes = Math.max(
      1,
      Math.min(
        Number(minutes) || this.config.defaultLogWindowMinutes,
        1440
      )
    );

    const maxItems = Math.max(
      1,
      Math.min(Number(limit) || this.config.defaultLogLimit, 500)
    );

    const requestedLevel = normalizeString(
      level || this.config.defaultLogLevel
    );

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