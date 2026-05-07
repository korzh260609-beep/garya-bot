// AGENT NOTE:
// SG 2.0 Render request processor.
// Purpose: process one safe Render diagnostic request through the read-only Render bridge.
// Do not read/write GitHub workspace files, poll, mutate Render, deploy, restart, or update env here.

import renderBridgeClient from "./renderBridgeClient.js";
import { getRenderBridgeDiag } from "./renderBridgeConfig.js";
import { RENDER_REQUEST_TYPES, isRenderRequestTypeAllowed } from "./renderRequestTypes.js";
import {
  buildRenderDeploysResponse,
  buildRenderEnvSummaryResponse,
  buildRenderErrorResponse,
  buildRenderLogsResponse,
  buildRenderStatusResponse,
} from "./renderResponseBuilder.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value, fallback, min = 1, max = 1000) {
  const n = Number(value);
  const base = Number.isFinite(n) ? Math.trunc(n) : Math.trunc(Number(fallback) || min);
  return Math.max(min, Math.min(max, base));
}

function serviceMatchesTarget(service = {}, target = "garya-bot") {
  const q = normalizeString(target || "garya-bot").toLowerCase();
  if (!q) return false;

  return (
    normalizeString(service.id).toLowerCase() === q ||
    normalizeString(service.name).toLowerCase() === q ||
    normalizeString(service.slug).toLowerCase() === q
  );
}

export class RenderRequestProcessor {
  constructor({ client } = {}) {
    this.client = client || renderBridgeClient;
  }

  normalizeRequest(request = {}) {
    return {
      ...request,
      request_id: normalizeString(request.request_id || request.requestId || "manual"),
      type: normalizeString(request.type),
      status: normalizeString(request.status || "requested"),
      target: normalizeString(request.target || "garya-bot"),
    };
  }

  validateRequest(request = {}) {
    if (!request.type) {
      throw new Error("render_request_type_missing");
    }

    if (!isRenderRequestTypeAllowed(request.type)) {
      throw new Error(`render_request_type_not_allowed:${request.type}`);
    }

    if (request.status && request.status !== "requested") {
      throw new Error(`render_request_status_not_processable:${request.status}`);
    }

    return request;
  }

  async resolveTargetService(target = "garya-bot") {
    const services = await this.client.listServices({ filter: target });
    const selected =
      services.find((service) => serviceMatchesTarget(service, target)) ||
      (services.length === 1 ? services[0] : null);

    if (!selected?.id) {
      throw new Error("render_target_service_not_found");
    }

    return selected;
  }

  async handleEnvSummary(request) {
    return buildRenderEnvSummaryResponse({
      request,
      diag: getRenderBridgeDiag(),
    });
  }

  async handleStatus(request) {
    const diag = getRenderBridgeDiag();
    const services = await this.client.listServices({ filter: request.target });
    const service = services.find((item) => serviceMatchesTarget(item, request.target)) || services[0] || null;
    const deploys = service?.id
      ? await this.client.listDeploys({
          serviceId: service.id,
          limit: 1,
        })
      : [];

    return buildRenderStatusResponse({ request, diag, services, deploys });
  }

  async handleDeploys(request) {
    const service = await this.resolveTargetService(request.target);
    const deploys = await this.client.listDeploys({
      serviceId: service.id,
      limit: positiveInt(request.limit, 20, 1, 20),
    });

    return buildRenderDeploysResponse({ request, service, deploys });
  }

  async handleLogs(request) {
    const service = await this.resolveTargetService(request.target);
    const limit = positiveInt(request.limit, 100, 1, 1000);
    const level = normalizeString(request.level || "all") || "all";

    const logs = await this.client.listLogsByCount({
      ownerId: service.ownerId,
      serviceId: service.id,
      level,
      limit,
    });

    return buildRenderLogsResponse({
      request,
      service,
      logs,
      meta: {
        level,
        limit,
        target: request.target,
      },
    });
  }

  async handleLatestDeployLogs(request) {
    const service = await this.resolveTargetService(request.target);
    const deploys = await this.client.listDeploys({ serviceId: service.id, limit: 1 });
    const latest = deploys[0] || null;

    if (!latest?.id) {
      throw new Error("render_latest_deploy_not_found");
    }

    const limit = positiveInt(request.limit, 400, 1, 1000);
    const level = normalizeString(request.level || "all") || "all";
    const logs = await this.client.listRecentLogs({
      ownerId: service.ownerId,
      serviceId: service.id,
      level,
      limit,
      startTime: latest.createdAt || "",
      endTime: latest.finishedAt || "",
    });

    return buildRenderLogsResponse({
      request: {
        ...request,
        type: RENDER_REQUEST_TYPES.LATEST_DEPLOY_LOGS,
      },
      service,
      logs,
      meta: {
        level,
        limit,
        target: request.target,
        deployId: latest.id,
      },
    });
  }

  async process(request = {}) {
    const normalized = this.validateRequest(this.normalizeRequest(request));

    try {
      if (normalized.type === RENDER_REQUEST_TYPES.ENV_SUMMARY) {
        return await this.handleEnvSummary(normalized);
      }

      if (normalized.type === RENDER_REQUEST_TYPES.STATUS) {
        return await this.handleStatus(normalized);
      }

      if (normalized.type === RENDER_REQUEST_TYPES.DEPLOYS) {
        return await this.handleDeploys(normalized);
      }

      if (normalized.type === RENDER_REQUEST_TYPES.LOGS) {
        return await this.handleLogs(normalized);
      }

      if (normalized.type === RENDER_REQUEST_TYPES.LATEST_DEPLOY_LOGS) {
        return await this.handleLatestDeployLogs(normalized);
      }

      throw new Error(`render_request_type_not_implemented:${normalized.type}`);
    } catch (error) {
      return buildRenderErrorResponse({
        request: normalized,
        error,
        type: normalized.type,
      });
    }
  }
}

export const renderRequestProcessor = new RenderRequestProcessor();

export default renderRequestProcessor;
