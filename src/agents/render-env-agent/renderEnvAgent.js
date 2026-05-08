// AGENT NOTE:
// RenderEnvAgent simple collector.
// Purpose: collect Render env inventory, hide secret values, and write one latest JSON report.
// Do not add env writes, deletes, deploys, restarts, AI calls, DB calls, or Telegram flow here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import renderBridgeClient from "../../integrations/render/renderBridgeClient.js";
import { getRenderBridgeDiag } from "../../integrations/render/renderBridgeConfig.js";

const LATEST_RENDER_ENV_PATH = "runtime/render/latest/latest-render-env.json";

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

const SECRET_VALUE_PATTERNS = Object.freeze([
  /sk-[A-Za-z0-9_-]{12,}/,
  /ghp_[A-Za-z0-9_]{12,}/,
  /github_pat_[A-Za-z0-9_]{12,}/,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /postgres(?:ql)?:\/\/[^\s]+/i,
  /mongodb(?:\+srv)?:\/\/[^\s]+/i,
  /redis:\/\/[^\s]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^[A-Za-z0-9_-]{32,}$/,
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isSecretEnvName(name) {
  const upper = normalizeString(name).toUpperCase();
  if (!upper) return true;
  return SECRET_NAME_PARTS.some((part) => upper.includes(part));
}

function isSecretEnvValue(value) {
  const text = normalizeString(value);
  if (!text) return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text));
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

      const rawValue = extractEnvValue(item);
      const secretByName = isSecretEnvName(name);
      const secretByValue = isSecretEnvValue(rawValue);
      const secret = secretByName || secretByValue;

      return {
        name,
        exists: true,
        is_secret: secret,
        secret_reason: secretByName ? "name" : secretByValue ? "value" : "none",
        value_exposed: !secret,
        value: secret ? "[HIDDEN]" : rawValue,
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
    secrets_policy: "secret_values_hidden_by_name_or_value",
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
