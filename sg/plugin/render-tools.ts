import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";

const RENDER_API_BASE = "https://api.render.com/v1";
const MAX_PAGE_SIZE = 100;
const MAX_BLUEPRINT_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_TEXT = 1_000_000;

const ACTIONS = [
  "status",
  "list_workspaces",
  "list_services",
  "get_service",
  "list_deploys",
  "get_deploy",
  "logs",
  "metrics",
  "deploy_commit",
  "cancel_deploy",
  "restart_service",
  "rollback_service",
  "list_env",
  "set_env",
  "validate_blueprint",
] as const;

const METRICS = [
  "cpu",
  "memory",
  "instance_count",
  "http_requests",
  "bandwidth",
  "http_latency",
] as const;

type RenderAction = (typeof ACTIONS)[number];
type RenderMetric = (typeof METRICS)[number];

type RenderParameters = {
  action?: RenderAction;
  serviceId?: string;
  workspaceId?: string;
  deployId?: string;
  commitId?: string;
  clearCache?: boolean;
  limit?: number;
  startTime?: string;
  endTime?: string;
  logTypes?: string[];
  logLevels?: string[];
  text?: string[];
  metric?: RenderMetric;
  resolutionSeconds?: number;
  envKey?: string;
  envValue?: string;
  blueprint?: string;
};

type RenderRequest = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  form?: FormData;
};

function configured(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function appendMany(search: URLSearchParams, key: string, values: unknown): void {
  if (!Array.isArray(values)) {
    return;
  }
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      search.append(key, value.trim());
    }
  }
}

function scrubString(value: string, apiKey: string): string {
  let scrubbed = apiKey ? value.split(apiKey).join("[REDACTED]") : value;
  scrubbed = scrubbed.replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]");
  return scrubbed.replace(
    /\b(api[_-]?key|token|password|secret|credential)\s*[:=]\s*[^\s,;]+/giu,
    "$1=[REDACTED]",
  );
}

function sanitize(value: unknown, apiKey: string): unknown {
  if (typeof value === "string") {
    return scrubString(value, apiKey);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, apiKey));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = /secret|token|password|credential|api.?key|connection.?string/iu.test(key)
        ? "[REDACTED]"
        : sanitize(child, apiKey);
    }
    return result;
  }
  return value;
}

function invalid(reason: string) {
  return jsonResult({ status: "invalid_request", reason });
}

function missingIdentifier(kind: "workspace" | "service" | "deploy") {
  return invalid(`${kind}-id-required`);
}

function resourceId(explicit: unknown, environmentName: string): string | undefined {
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  return configured(environmentName);
}

function pathId(value: string): string {
  return encodeURIComponent(value);
}

async function renderRequest(apiKey: string, path: string, request: RenderRequest = {}) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  let body: BodyInit | undefined;
  if (request.form) {
    body = request.form;
  } else if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(request.body);
  }

  let response: Response;
  try {
    response = await fetch(`${RENDER_API_BASE}${path}`, {
      method: request.method ?? "GET",
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown request failure";
    return {
      ok: false as const,
      result: jsonResult({
        status: "error",
        reason: "render-api-request-failed",
        error: scrubString(message, apiKey).slice(0, 8_000),
      }),
    };
  }

  const responseText = (await response.text()).slice(0, MAX_RESPONSE_TEXT);
  let data: unknown;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }
  const safeData = sanitize(data, apiKey);
  if (!response.ok) {
    return {
      ok: false as const,
      result: jsonResult({
        status: "error",
        reason: "render-api-error",
        httpStatus: response.status,
        error: safeData,
      }),
    };
  }
  return { ok: true as const, data: safeData };
}

async function performAction(action: RenderAction, params: RenderParameters, apiKey: string) {
  const workspaceId = resourceId(params.workspaceId, "RENDER_WORKSPACE_ID");
  const serviceId = resourceId(params.serviceId, "RENDER_SERVICE_ID");
  const deployId =
    typeof params.deployId === "string" && params.deployId.trim()
      ? params.deployId.trim()
      : undefined;
  const limit = clampInteger(params.limit, 50, 1, MAX_PAGE_SIZE);
  let response: Awaited<ReturnType<typeof renderRequest>>;

  switch (action) {
    case "list_workspaces":
      response = await renderRequest(apiKey, `/owners?limit=${limit}`);
      break;
    case "list_services": {
      if (!workspaceId) {
        return missingIdentifier("workspace");
      }
      const search = new URLSearchParams({ ownerId: workspaceId, limit: String(limit) });
      response = await renderRequest(apiKey, `/services?${search}`);
      break;
    }
    case "get_service":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      response = await renderRequest(apiKey, `/services/${pathId(serviceId)}`);
      break;
    case "list_deploys":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      response = await renderRequest(
        apiKey,
        `/services/${pathId(serviceId)}/deploys?limit=${limit}`,
      );
      break;
    case "get_deploy":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!deployId) {
        return missingIdentifier("deploy");
      }
      response = await renderRequest(
        apiKey,
        `/services/${pathId(serviceId)}/deploys/${pathId(deployId)}`,
      );
      break;
    case "logs": {
      if (!workspaceId) {
        return missingIdentifier("workspace");
      }
      if (!serviceId) {
        return missingIdentifier("service");
      }
      const search = new URLSearchParams({
        ownerId: workspaceId,
        resource: serviceId,
        limit: String(limit),
        direction: "backward",
      });
      if (params.startTime) {
        search.set("startTime", params.startTime);
      }
      if (params.endTime) {
        search.set("endTime", params.endTime);
      }
      appendMany(search, "type", params.logTypes);
      appendMany(search, "level", params.logLevels);
      appendMany(search, "text", params.text);
      response = await renderRequest(apiKey, `/logs?${search}`);
      break;
    }
    case "metrics": {
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!params.metric || !METRICS.includes(params.metric)) {
        return invalid("metric-required");
      }
      const search = new URLSearchParams({ resource: serviceId });
      if (params.startTime) {
        search.set("startTime", params.startTime);
      }
      if (params.endTime) {
        search.set("endTime", params.endTime);
      }
      search.set(
        "resolutionSeconds",
        String(clampInteger(params.resolutionSeconds, 60, 30, 86_400)),
      );
      response = await renderRequest(
        apiKey,
        `/metrics/${params.metric.replaceAll("_", "-")}?${search}`,
      );
      break;
    }
    case "deploy_commit":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!params.commitId || !/^[0-9a-f]{40}$/iu.test(params.commitId)) {
        return invalid("commit-id-must-be-full-sha");
      }
      response = await renderRequest(apiKey, `/services/${pathId(serviceId)}/deploys`, {
        method: "POST",
        body: {
          commitId: params.commitId,
          clearCache: params.clearCache === true ? "clear" : "do_not_clear",
        },
      });
      break;
    case "cancel_deploy":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!deployId) {
        return missingIdentifier("deploy");
      }
      response = await renderRequest(
        apiKey,
        `/services/${pathId(serviceId)}/deploys/${pathId(deployId)}/cancel`,
        { method: "POST" },
      );
      break;
    case "restart_service":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      response = await renderRequest(apiKey, `/services/${pathId(serviceId)}/restart`, {
        method: "POST",
      });
      break;
    case "rollback_service":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!deployId) {
        return missingIdentifier("deploy");
      }
      response = await renderRequest(apiKey, `/services/${pathId(serviceId)}/rollback`, {
        method: "POST",
        body: { deployId },
      });
      break;
    case "list_env": {
      if (!serviceId) {
        return missingIdentifier("service");
      }
      response = await renderRequest(apiKey, `/services/${pathId(serviceId)}/env-vars`);
      if (!response.ok) {
        return response.result;
      }
      const rows = Array.isArray(response.data) ? response.data : [];
      const data = rows.flatMap((row) => {
        if (!row || typeof row !== "object") {
          return [];
        }
        const envVar = (row as { envVar?: unknown }).envVar;
        if (!envVar || typeof envVar !== "object") {
          return [];
        }
        const key = (envVar as { key?: unknown }).key;
        return typeof key === "string" ? [{ key }] : [];
      });
      return jsonResult({ status: "ok", action, data });
    }
    case "set_env":
      if (!serviceId) {
        return missingIdentifier("service");
      }
      if (!params.envKey || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(params.envKey)) {
        return invalid("valid-env-key-required");
      }
      if (typeof params.envValue !== "string") {
        return invalid("env-value-required");
      }
      response = await renderRequest(
        apiKey,
        `/services/${pathId(serviceId)}/env-vars/${pathId(params.envKey)}`,
        { method: "PUT", body: { value: params.envValue } },
      );
      if (!response.ok) {
        return response.result;
      }
      return jsonResult({
        status: "ok",
        action,
        data: { key: params.envKey, updated: true },
      });
    case "validate_blueprint": {
      if (!workspaceId) {
        return missingIdentifier("workspace");
      }
      if (!params.blueprint?.trim()) {
        return invalid("blueprint-required");
      }
      if (Buffer.byteLength(params.blueprint, "utf8") > MAX_BLUEPRINT_BYTES) {
        return invalid("blueprint-too-large");
      }
      const form = new FormData();
      form.set("ownerId", workspaceId);
      form.set("file", new Blob([params.blueprint], { type: "application/yaml" }), "render.yaml");
      response = await renderRequest(apiKey, "/blueprints/validate", { method: "POST", form });
      break;
    }
    case "status":
      return invalid("status-is-handled-before-api-request");
  }

  if (!response.ok) {
    return response.result;
  }
  return jsonResult({ status: "ok", action, data: response.data });
}

export function createSgRenderTool(_ctx: OpenClawPluginToolContext): AnyAgentTool {
  return {
    name: "sg_render",
    label: "Render SG",
    description:
      "Monarch-only Render API operations for services, deploys, logs, metrics, ENV, and Blueprint validation. " +
      "For post-deploy checks use Live status, source SHA, image_commit logs, /health, gateway, Telegram, model API, sg_render, then RSS. " +
      "Automated post-deploy checks must not open Control UI or a browser automatically; report UI as not_verified and continue the remaining deploy checks. " +
      "Obtain RSS evidence server-side using sg_render action=metrics with metric=memory. Never use a public debug URL for RSS.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { type: "string", enum: [...ACTIONS] },
        workspaceId: { type: "string" },
        serviceId: { type: "string" },
        deployId: { type: "string" },
        commitId: { type: "string" },
        clearCache: { type: "boolean" },
        limit: { type: "number", minimum: 1, maximum: MAX_PAGE_SIZE },
        startTime: { type: "string" },
        endTime: { type: "string" },
        logTypes: { type: "array", items: { type: "string" }, maxItems: 10 },
        logLevels: { type: "array", items: { type: "string" }, maxItems: 10 },
        text: { type: "array", items: { type: "string" }, maxItems: 10 },
        metric: { type: "string", enum: [...METRICS] },
        resolutionSeconds: { type: "number", minimum: 30, maximum: 86_400 },
        envKey: { type: "string" },
        envValue: { type: "string" },
        blueprint: { type: "string" },
      },
    },
    async execute(_toolCallId, rawParameters) {
      const params = (rawParameters ?? {}) as RenderParameters;
      if (!params.action || !ACTIONS.includes(params.action)) {
        return invalid("supported-action-required");
      }
      const apiKey = configured("RENDER_API_KEY");
      if (!apiKey) {
        return jsonResult({ status: "unavailable", reason: "render-api-key-missing" });
      }
      if (params.action === "status") {
        return jsonResult({
          status: "ready",
          workspaceConfigured: configured("RENDER_WORKSPACE_ID") !== undefined,
          serviceConfigured: configured("RENDER_SERVICE_ID") !== undefined,
        });
      }
      return performAction(params.action, params, apiKey);
    },
  };
}
