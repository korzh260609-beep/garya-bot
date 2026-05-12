// AGENT NOTE:
// RenderEnvAgent simple collector.
// Purpose: collect Render env inventory, hide secret values, and write one latest JSON report.
// Do not add env writes, deletes, deploys, restarts, AI calls, DB calls, or Telegram flow here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import renderBridgeClient from "../../integrations/render/renderBridgeClient.js";
import { getRenderBridgeDiag } from "../../integrations/render/renderBridgeConfig.js";

const LATEST_RENDER_ENV_PATH = "runtime/render/latest/latest-render-env.json";
const RENDER_ENV_PAGE_LIMIT = 100;
const RENDER_ENV_MAX_PAGES = 20;

const SECRET_NAME_EXACT = Object.freeze([
  "DATABASE_URL",
  "DB_URL",
  "REDIS_URL",
  "MONGO_URL",
  "MONGODB_URI",
  "CONNECTION_STRING",
  "OPENAI_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_PAT",
  "GITHUB_APP_PRIVATE_KEY",
  "RENDER_API_KEY",
]);

const SECRET_NAME_SUFFIXES = Object.freeze([
  "_SECRET",
  "_TOKEN",
  "_API_KEY",
  "_PRIVATE_KEY",
  "_PASSWORD",
  "_WEBHOOK_SECRET",
  "_SIGNING_SECRET",
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSecretEnvName(name) {
  const upper = normalizeString(name).toUpperCase();
  if (!upper) return true;
  if (SECRET_NAME_EXACT.includes(upper)) return true;
  return SECRET_NAME_SUFFIXES.some((suffix) => upper.endsWith(suffix));
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

function extractRenderEnvSource(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.envVars)) return raw.envVars;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function extractNextCursor(raw) {
  if (!isPlainObject(raw)) return "";

  return (
    normalizeString(raw.nextCursor) ||
    normalizeString(raw.next_cursor) ||
    normalizeString(raw.cursor) ||
    normalizeString(raw.pagination?.nextCursor) ||
    normalizeString(raw.pagination?.next_cursor) ||
    normalizeString(raw.meta?.nextCursor) ||
    normalizeString(raw.meta?.next_cursor) ||
    normalizeString(raw.links?.nextCursor) ||
    normalizeString(raw.links?.next_cursor)
  );
}

function normalizeRenderEnvItems(raw) {
  return extractRenderEnvSource(raw)
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

function dedupeEnvItems(items = []) {
  const map = new Map();

  for (const item of items) {
    const name = normalizeString(item?.name);
    if (!name) continue;
    map.set(name, item);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function listRenderEnvVarsPage({ serviceId, cursor = "" }) {
  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) throw new Error("render_service_id_missing");

  return renderBridgeClient.request(
    `/services/${encodeURIComponent(normalizedServiceId)}/env-vars`,
    {
      query: {
        limit: RENDER_ENV_PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      },
    }
  );
}

async function listRenderEnvVars({ serviceId }) {
  const pages = [];
  const allItems = [];
  const seenCursors = new Set();
  let cursor = "";
  let truncated = false;

  for (let page = 0; page < RENDER_ENV_MAX_PAGES; page += 1) {
    const raw = await listRenderEnvVarsPage({ serviceId, cursor });
    const items = extractRenderEnvSource(raw);
    const nextCursor = extractNextCursor(raw);

    pages.push({
      index: page + 1,
      items_count: items.length,
      has_next_cursor: Boolean(nextCursor),
    });
    allItems.push(...items);

    if (!nextCursor) break;

    if (seenCursors.has(nextCursor)) {
      truncated = true;
      break;
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;

    if (page === RENDER_ENV_MAX_PAGES - 1) {
      truncated = true;
    }
  }

  return {
    raw: allItems,
    pagination: {
      page_limit: RENDER_ENV_PAGE_LIMIT,
      max_pages: RENDER_ENV_MAX_PAGES,
      pages_count: pages.length,
      pages,
      truncated,
    },
  };
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
  const envResult = await listRenderEnvVars({ serviceId: service.id });
  const env = dedupeEnvItems(normalizeRenderEnvItems(envResult.raw));
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
    pagination: envResult.pagination,
    secrets_policy: "secret_values_hidden_by_exact_name_suffix_or_value",
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
    pagination: data.pagination,
    service: data.service,
    write,
  };
}

export default {
  collectRenderEnvInventory,
  runRenderEnvAgent,
};
