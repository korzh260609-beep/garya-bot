// AGENT NOTE:
// RenderEnvAgent simple collector.
// Purpose: collect Render env inventory, hide secrets, and write one latest JSON report.
// Do not add env writes, deletes, deploys, restarts, AI calls, DB calls, or Telegram flow here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import renderBridgeClient from "../../integrations/render/renderBridgeClient.js";
import { getRenderBridgeDiag } from "../../integrations/render/renderBridgeConfig.js";

const LATEST_RENDER_ENV_PATH = "runtime/render/latest/latest-render-env.json";

const SAFE_VALUE_ALLOWLIST = Object.freeze([
  "NODE_ENV",
  "PORT",
  "RENDER_BRIDGE_ENABLED",
  "RENDER_API_BASE_URL",
  "RENDER_BRIDGE_TIMEOUT_MS",
  "RENDER_BRIDGE_DEFAULT_SOURCE_KEY",
  "RENDER_BRIDGE_DEFAULT_LOG_LEVEL",
  "RENDER_BRIDGE_DEFAULT_LOG_WINDOW_MINUTES",
  "RENDER_BRIDGE_DEFAULT_LOG_LIMIT",
  "RENDER_BRIDGE_DEFAULT_DEPLOY_LIMIT",
]);

const SECRET_NAME_PARTS = Object.freeze([
  "KEY",
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "PASS",
  "AUTH",
  "PRIVATE",
  "DATABASE_URL",
  "DB_URL",
  "CONNECTION_STRING",
  "OPENAI",
  "TELEGRAM",
  "GITHUB",
  "RENDER_API_KEY",
  "WEBHOOK",
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isSecretEnvName(name) {
  const upper = normalizeString(name).toUpperCase();
  if (!upper) return true;
  return SECRET_NAME_PARTS.some((part) => upper.includes(part));
}

function canExposeValue(name) {
  const upper = normalizeString(name).toUpperCase();
  return SAFE_VALUE_ALLOWLIST.includes(upper) && !isSecretEnvName(upper);
}

function extractEnvName(item = {}) {
  return (
    normalizeString(item.key) ||
    normalizeString(item.name) ||
    normalizeString(item.envVarKey) ||
    normalizeString(item.envVar?.key) ||
    normalizeString(item.envVar?.name)
  );
}

function extractEnvValue(item = {}) {
  if (typeof item.value === "string") return item.value;
  if (typeof item.envVar?.value === "string") return item.envVar.value;
  return "";
}

function normalizeRenderEnvItems(raw) {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.envVars)
      ? raw.envVars
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  return source
    .map((item) => {
      const name = extractEnvName(item);
      if (!name) return null;

      const secret = isSecretEnvName(name);
      const expose = canExposeValue(name);
      const value = expose ? extractEnvValue(item) : "[HIDDEN]";

      return {
        name,
        exists: true,
        is_secret: secret || !expose,
        value_exposed: expose,
        value,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listRenderEnvVars({ serviceId }) {
  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) throw new Error("render_service_id_missing");

  return renderBridgeClient.request(
    `/services/${encodeURIComponent(normalizedServiceId)}/env-vars`
  );
}

async function resolveService(target = "garya-bot") {
  const safeTarget = normalizeString(target || "garya-bot") || "garya-bot";
  const resolved = await renderBridgeClient.resolveService(safeTarget);
  if (!resolved.ok || !resolved.service?.id) {
    throw new Error(resolved.error || "render_service_not_found");
  }
  return resolved.service;
}

export async function collectRenderEnvInventory({ target = "garya-bot" } = {}) {
  const safeTarget = normalizeString(target || "garya-bot") || "garya-bot";
  const service = await resolveService(safeTarget);
  const raw = await listRenderEnvVars({ serviceId: service.id });
  const env = normalizeRenderEnvItems(raw);
  const diag = getRenderBridgeDiag();

  return {
    ok: true,
    type: "render_env_inventory",
    generated_at: new Date().toISOString(),
    target: safeTarget,
    service: {
      id: service.id || "",
      name: service.name || "",
      slug: service.slug || "",
      ownerId: service.ownerId || "",
    },
    bridge: {
      ready: Boolean(diag.ready),
      enabled: Boolean(diag.enabled),
      has_api_key: Boolean(diag.hasApiKey),
    },
    env_count: env.length,
    env,
    secrets_policy: "secret_or_unknown_env_values_hidden",
  };
}

export async function runRenderEnvAgent({ target = "garya-bot" } = {}) {
  const data = await collectRenderEnvInventory({ target });
  const write = await workspaceChannel.writeJson(LATEST_RENDER_ENV_PATH, data, {
    message: `render env: update latest ${data.env_count || 0}`,
  });

  return {
    ok: true,
    type: "render_env_agent",
    path: LATEST_RENDER_ENV_PATH,
    env_count: data.env_count,
    service: data.service,
    write,
  };
}

export default {
  collectRenderEnvInventory,
  runRenderEnvAgent,
};
