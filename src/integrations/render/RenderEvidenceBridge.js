// src/integrations/render/RenderEvidenceBridge.js
// SG 2.0 — Render Evidence Bridge v1.
// Purpose: collect sanitized Render deploy/log evidence for Observation/Project Memory trusted paths.
// This module does not write Project Memory, does not write runtime files, does not mutate repo/env,
// does not touch Telegram, does not call AI, and does not expose raw logs or secrets.

import { getRenderEvidenceConfig, getRenderEvidenceDiag } from "./RenderEvidenceConfig.js";

export const RENDER_EVIDENCE_BRIDGE_VERSION = 1;

export const RENDER_EVIDENCE_DECISIONS = Object.freeze({
  DEPLOY_EVIDENCE_COLLECTED: "render_deploy_evidence_collected",
  REQUEST_REJECTED: "render_evidence_request_rejected",
});

const ERROR_LEVELS = new Set(["error", "fatal", "critical", "panic"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function positiveInt(value, fallback, min = 1, max = 10_000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(min, Math.min(max, Math.trunc(Number(fallback) || min)));
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeIso(value) {
  const raw = normalizeString(value);
  if (!raw) return "";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function normalizeDeploy(raw = {}) {
  const item = normalizePlainObject(raw.deploy || raw.serviceDeploy || raw.item || raw);
  const commit = normalizePlainObject(item.commit);

  return {
    id: normalizeString(item.id || item.deployId),
    status: normalizeString(item.status || item.state || "unknown").toLowerCase(),
    commit: normalizeString(commit.id || commit.sha || item.commitId || item.commitSha),
    createdAt: normalizeIso(item.createdAt || item.created_at),
    finishedAt: normalizeIso(item.finishedAt || item.finished_at || item.updatedAt || item.updated_at),
  };
}

function normalizeDeploys(raw) {
  if (Array.isArray(raw)) return raw.map(normalizeDeploy).filter((deploy) => deploy.id || deploy.commit || deploy.status);

  const object = normalizePlainObject(raw);
  const candidates = [
    object.deploys,
    object.items,
    object.data,
    object.results,
    object.value,
  ].find(Array.isArray);

  if (Array.isArray(candidates)) {
    return candidates.map(normalizeDeploy).filter((deploy) => deploy.id || deploy.commit || deploy.status);
  }

  const one = normalizeDeploy(object);
  return one.id || one.commit || one.status !== "unknown" ? [one] : [];
}

function normalizeLog(raw = {}) {
  const item = normalizePlainObject(raw);
  const message = normalizeString(item.message || item.msg || item.text || item.body);
  const level = normalizeString(item.level || item.severity || item.type || "info").toLowerCase();

  return {
    timestamp: normalizeIso(item.timestamp || item.time || item.createdAt || item.created_at),
    level,
    messagePresent: Boolean(message),
    isError: ERROR_LEVELS.has(level) || /\b(error|exception|failed|fatal|panic|uncaught)\b/i.test(message),
  };
}

function normalizeLogs(raw) {
  if (Array.isArray(raw)) return raw.map(normalizeLog);

  const object = normalizePlainObject(raw);
  const candidates = [
    object.logs,
    object.items,
    object.data,
    object.results,
    object.value,
  ].find(Array.isArray);

  if (Array.isArray(candidates)) return candidates.map(normalizeLog);
  return [];
}

function filterLogsByLevel(logs = [], requestedLevel = "error") {
  const level = normalizeString(requestedLevel || "error").toLowerCase();
  if (!level || level === "all" || level === "*") return logs;
  if (level === "error") return logs.filter((log) => log.isError);
  return logs.filter((log) => log.level === level);
}

function buildDeployLogWindow(deploy = {}, fallbackMinutes = 60) {
  const createdMs = Date.parse(deploy.createdAt || "");
  const finishedMs = Date.parse(deploy.finishedAt || "");

  if (Number.isFinite(createdMs)) {
    const start = Math.max(0, createdMs - 30_000);
    const end = Math.max(Number.isFinite(finishedMs) ? finishedMs : Date.now(), createdMs + 60_000) + 30_000;
    return {
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
    };
  }

  const end = Date.now();
  const start = end - positiveInt(fallbackMinutes, 60, 1, 1440) * 60_000;
  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
  };
}

export function getRenderEvidenceBridgeBoundaries() {
  return {
    sourceEvidenceOnly: true,
    sanitizedOutputOnly: true,
    emitsRawLogs: false,
    emitsSecrets: false,
    writesProjectMemory: false,
    writesRuntimeFiles: false,
    writesRepository: false,
    changesEnvironment: false,
    touchesTelegram: false,
    callsAI: false,
    canFetchRender: true,
    canUseInjectedClient: true,
  };
}

export function buildRenderEvidenceBridgeStatus({ env = process.env } = {}) {
  const diag = getRenderEvidenceDiag(env);

  return {
    ok: true,
    service: "RenderEvidenceBridge",
    version: RENDER_EVIDENCE_BRIDGE_VERSION,
    ready: diag.ready,
    enabled: diag.enabled,
    hasApiKey: diag.hasApiKey,
    hasServiceId: diag.hasServiceId,
    hasOwnerId: diag.hasOwnerId,
    boundaries: getRenderEvidenceBridgeBoundaries(),
  };
}

export class RenderEvidenceBridge {
  constructor({ config = null, client = null, fetchImpl = globalThis.fetch } = {}) {
    this.config = config || getRenderEvidenceConfig();
    this.client = client;
    this.fetchImpl = fetchImpl;
  }

  getDiag() {
    return {
      ...getRenderEvidenceDiag(),
      injectedClient: Boolean(this.client),
    };
  }

  ensureReady() {
    if (this.client) return;
    if (!this.config.enabled) throw new Error("render_evidence_disabled");
    if (!this.config.apiKey) throw new Error("render_evidence_api_key_missing");
    if (!this.config.serviceId) throw new Error("render_evidence_service_id_missing");
    if (typeof this.fetchImpl !== "function") throw new Error("render_evidence_fetch_unavailable");
  }

  async request(path, { query = {} } = {}) {
    this.ensureReady();

    if (this.client?.request) {
      return this.client.request(path, { query });
    }

    if (path === "deploys" && this.client?.listDeploys) {
      return this.client.listDeploys(query);
    }

    if (path === "logs" && this.client?.listLogs) {
      return this.client.listLogs(query);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = path.startsWith("/")
        ? buildUrl(this.config.apiBaseUrl, path, query)
        : buildUrl(this.config.apiBaseUrl, `/${path}`, query);
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          accept: "application/json",
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      if (!response.ok) {
        throw new Error(`render_evidence_http_${response.status}`);
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listDeploys({ serviceId = this.config.serviceId, limit = this.config.defaultDeployLimit } = {}) {
    const safeServiceId = normalizeString(serviceId);
    if (!safeServiceId) throw new Error("render_evidence_service_id_missing");

    const raw = this.client?.listDeploys
      ? await this.client.listDeploys({ serviceId: safeServiceId, limit })
      : await this.request(`/services/${encodeURIComponent(safeServiceId)}/deploys`);

    return normalizeDeploys(raw).slice(0, positiveInt(limit, this.config.defaultDeployLimit, 1, 20));
  }

  async listLogs({
    ownerId = this.config.ownerId,
    serviceId = this.config.serviceId,
    level = this.config.defaultLogLevel,
    limit = this.config.defaultLogLimit,
    startTime = "",
    endTime = "",
  } = {}) {
    const safeServiceId = normalizeString(serviceId);
    if (!safeServiceId) throw new Error("render_evidence_service_id_missing");

    const query = {
      ownerId: normalizeString(ownerId),
      resource: safeServiceId,
      serviceId: safeServiceId,
      limit: positiveInt(limit, this.config.defaultLogLimit, 1, 500),
      startTime,
      endTime,
    };

    const raw = this.client?.listLogs
      ? await this.client.listLogs(query)
      : await this.request("/logs", { query });

    return filterLogsByLevel(normalizeLogs(raw), level).slice(0, query.limit);
  }

  async collectDeployLogsEvidence({
    serviceId = this.config.serviceId,
    ownerId = this.config.ownerId,
    deployId = "",
    commit = "",
    level = this.config.defaultLogLevel,
    limit = this.config.defaultLogLimit,
  } = {}) {
    const collectedAt = nowIso();
    const deploys = await this.listDeploys({ serviceId, limit: this.config.defaultDeployLimit });
    const safeDeployId = normalizeString(deployId);
    const safeCommit = normalizeString(commit);

    const selectedDeploy =
      (safeDeployId ? deploys.find((deploy) => deploy.id === safeDeployId) : null) ||
      (safeCommit ? deploys.find((deploy) => deploy.commit === safeCommit) : null) ||
      deploys[0] ||
      null;

    if (!selectedDeploy) {
      return {
        ok: false,
        version: RENDER_EVIDENCE_BRIDGE_VERSION,
        decision: RENDER_EVIDENCE_DECISIONS.REQUEST_REJECTED,
        reason: "render_deploy_not_found",
        evidence: null,
        warnings: [],
        errors: [createError("render_deploy_not_found", "Render deploy evidence requires at least one deploy.")],
        boundaries: getRenderEvidenceBridgeBoundaries(),
      };
    }

    const window = buildDeployLogWindow(selectedDeploy, this.config.defaultLogWindowMinutes);
    const logs = await this.listLogs({
      ownerId,
      serviceId,
      level,
      limit,
      startTime: window.startTime,
      endTime: window.endTime,
    });
    const errorCount = logs.filter((log) => log.isError).length;
    const deployOk = ["live", "succeeded", "success", "deployed", "available"].includes(selectedDeploy.status);
    const logsClean = errorCount === 0;
    const sourceRef = selectedDeploy.id
      ? `render://deploy/${selectedDeploy.id}`
      : `render://service/${normalizeString(serviceId)}/latest-deploy`;

    return {
      ok: true,
      version: RENDER_EVIDENCE_BRIDGE_VERSION,
      decision: RENDER_EVIDENCE_DECISIONS.DEPLOY_EVIDENCE_COLLECTED,
      evidence: {
        sourceKind: "render_deploy_logs",
        eventType: deployOk && logsClean ? "deploy_ok" : "deploy_check_failed",
        sourceRef,
        approvalRef: sourceRef,
        policy: "automatic_project_evidence_chain",
        verified: deployOk && logsClean,
        deployOk,
        logsClean,
        errorCount,
        logsChecked: logs.length,
        serviceId: normalizeString(serviceId),
        deployId: selectedDeploy.id || null,
        commit: selectedDeploy.commit || null,
        deployStatus: selectedDeploy.status,
        createdAt: selectedDeploy.createdAt || "",
        finishedAt: selectedDeploy.finishedAt || "",
        collectedAt,
        sanitized: true,
      },
      warnings: logsClean ? [] : [createWarning("render_logs_not_clean", "Render logs contain error-level signals.", { errorCount })],
      errors: [],
      boundaries: getRenderEvidenceBridgeBoundaries(),
    };
  }
}

export const renderEvidenceBridge = new RenderEvidenceBridge();

export default renderEvidenceBridge;
