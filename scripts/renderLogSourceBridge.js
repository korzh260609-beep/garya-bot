// ============================================================================
// scripts/renderLogSourceBridge.js
// PURPOSE:
// - pull log snapshot from a real external source URL
// - normalize text/json payload
// - forward it into SG ingest route
//
// IMPORTANT:
// - this file does NOT hardcode any Render API assumptions
// - it is source-first and generic
// - once a real machine-readable log source exists, only secrets/env are needed
//
// REQUIRED ENV:
// - LOG_SOURCE_URL
// - RENDER_LOG_INGEST_URL
// - RENDER_LOG_INGEST_TOKEN
//
// OPTIONAL ENV:
// - LOG_SOURCE_METHOD=GET|POST               (default: GET)
// - LOG_SOURCE_BODY='{"...":"..."}'         (for POST source fetch)
// - LOG_SOURCE_TIMEOUT_MS=20000
//
// AUTH TO SOURCE:
// - LOG_SOURCE_AUTH_TYPE=none|bearer|header|query   (default: none)
// - LOG_SOURCE_AUTH_TOKEN=...
// - LOG_SOURCE_AUTH_HEADER_NAME=Authorization
// - LOG_SOURCE_QUERY_PARAM=token
//
// BRIDGE NORMALIZATION:
// - BRIDGE_MODE=error|deploy                (default: error)
// - BRIDGE_SOURCE_KEY=render_primary
// - BRIDGE_STATUS=failed
// - BRIDGE_DEPLOY_ID=...
//
// NOTES:
// - plain text source => whole body becomes logText
// - json source => tries known top-level keys
// - if deploy mode has no deployId in source or env, timestamp id is generated
// ============================================================================

import fetch from "node-fetch";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMode(value) {
  const s = normalizeString(value).toLowerCase();
  return s === "deploy" ? "deploy" : "error";
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function envInt(name, fallback) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.trunc(raw);
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getByKnownKeys(obj, keys) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getObjectByKey(obj, key) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const value = obj[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function buildSourceRequestUrl(baseUrl, authType, authToken, queryParam) {
  if (authType !== "query" || !authToken) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set(queryParam || "token", authToken);
  return url.toString();
}

function buildSourceHeaders(authType, authToken, authHeaderName) {
  const headers = {};

  if (!authToken || authType === "none" || authType === "query") {
    return headers;
  }

  if (authType === "bearer") {
    headers.Authorization = `Bearer ${authToken}`;
    return headers;
  }

  if (authType === "header") {
    headers[authHeaderName || "Authorization"] = authToken;
    return headers;
  }

  return headers;
}

async function fetchSourceSnapshot() {
  const baseUrl = normalizeString(process.env.LOG_SOURCE_URL);
  const method = normalizeString(process.env.LOG_SOURCE_METHOD || "GET").toUpperCase() || "GET";
  const bodyRaw = normalizeString(process.env.LOG_SOURCE_BODY || "");
  const timeoutMs = envInt("LOG_SOURCE_TIMEOUT_MS", 20000);

  const authType = normalizeString(process.env.LOG_SOURCE_AUTH_TYPE || "none").toLowerCase() || "none";
  const authToken = normalizeString(process.env.LOG_SOURCE_AUTH_TOKEN || "");
  const authHeaderName = normalizeString(process.env.LOG_SOURCE_AUTH_HEADER_NAME || "Authorization");
  const queryParam = normalizeString(process.env.LOG_SOURCE_QUERY_PARAM || "token");

  if (!baseUrl) {
    throw new Error("Missing LOG_SOURCE_URL");
  }

  const url = buildSourceRequestUrl(baseUrl, authType, authToken, queryParam);
  const headers = buildSourceHeaders(authType, authToken, authHeaderName);

  let body = undefined;
  if (method === "POST" && bodyRaw) {
    headers["content-type"] = "application/json";
    body = bodyRaw;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    const contentType = normalizeString(response.headers.get("content-type") || "");

    if (!response.ok) {
      throw new Error(`Source fetch failed: status=${response.status} body=${text.slice(0, 500)}`);
    }

    return {
      ok: true,
      url,
      method,
      status: response.status,
      contentType,
      text,
      json: contentType.includes("application/json") ? parseJsonMaybe(text) : parseJsonMaybe(text),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFromSource(sourceResult) {
  const bridgeMode = normalizeMode(process.env.BRIDGE_MODE || "error");
  const fallbackSourceKey = normalizeString(process.env.BRIDGE_SOURCE_KEY || "render_primary") || "render_primary";
  const fallbackStatus = normalizeString(process.env.BRIDGE_STATUS || "failed") || "failed";
  const fallbackDeployId = normalizeString(process.env.BRIDGE_DEPLOY_ID || "");

  const json = sourceResult?.json;
  const isJsonObject = json && typeof json === "object" && !Array.isArray(json);

  let logText = "";
  let sourceKey = fallbackSourceKey;
  let deployId = fallbackDeployId;
  let status = fallbackStatus;
  let meta = {
    sourceUrl: sourceResult?.url || "",
    sourceMethod: sourceResult?.method || "",
    sourceHttpStatus: sourceResult?.status || 0,
    sourceContentType: sourceResult?.contentType || "",
    bridge: "render_log_source_bridge",
  };

  if (isJsonObject) {
    logText =
      getByKnownKeys(json, ["logText", "log", "logs", "message", "text", "output", "body"]) ||
      "";

    sourceKey =
      getByKnownKeys(json, ["sourceKey", "source_key"]) ||
      fallbackSourceKey;

    deployId =
      getByKnownKeys(json, ["deployId", "deploy_id", "deploymentId", "deployment_id"]) ||
      fallbackDeployId;

    status =
      getByKnownKeys(json, ["status", "state", "result"]) ||
      fallbackStatus;

    const upstreamMeta = getObjectByKey(json, "meta");
    if (upstreamMeta) {
      meta = {
        ...meta,
        ...upstreamMeta,
      };
    }

    if (!logText) {
      logText = normalizeString(sourceResult?.text || "");
    }
  } else {
    logText = normalizeString(sourceResult?.text || "");
  }

  if (bridgeMode === "deploy" && !deployId) {
    deployId = `auto_deploy_${Date.now()}`;
  }

  return {
    mode: bridgeMode,
    sourceKey,
    deployId,
    status,
    logText,
    meta,
  };
}

async function postToIngest(payload) {
  const ingestUrl = normalizeString(process.env.RENDER_LOG_INGEST_URL);
  const ingestToken = normalizeString(process.env.RENDER_LOG_INGEST_TOKEN);

  if (!ingestUrl) {
    throw new Error("Missing RENDER_LOG_INGEST_URL");
  }

  if (!ingestToken) {
    throw new Error("Missing RENDER_LOG_INGEST_TOKEN");
  }

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-render-log-token": ingestToken,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = parseJsonMaybe(text);

  if (!response.ok) {
    throw new Error(`Ingest failed: status=${response.status} body=${text.slice(0, 500)}`);
  }

  return {
    status: response.status,
    body: parsed || text,
  };
}

async function main() {
  const dryRun = envBool("BRIDGE_DRY_RUN", false);

  const sourceResult = await fetchSourceSnapshot();
  const normalized = normalizeFromSource(sourceResult);

  if (!normalized.logText && normalized.mode === "error") {
    throw new Error("Normalized logText is empty for error mode");
  }

  if (normalized.mode === "deploy" && !normalized.deployId) {
    throw new Error("Normalized deployId is empty for deploy mode");
  }

  const ingestPayload = {
    sourceKey: normalized.sourceKey,
    mode: normalized.mode,
    meta: normalized.meta,
  };

  if (normalized.mode === "error") {
    ingestPayload.logText = normalized.logText;
  }

  if (normalized.mode === "deploy") {
    ingestPayload.deployId = normalized.deployId;
    ingestPayload.status = normalized.status;
    ingestPayload.logText = normalized.logText;
  }

  console.log("SOURCE_FETCH_OK", JSON.stringify({
    sourceUrl: sourceResult.url,
    sourceHttpStatus: sourceResult.status,
    sourceContentType: sourceResult.contentType,
    logChars: normalized.logText.length,
    mode: normalized.mode,
    sourceKey: normalized.sourceKey,
    deployId: normalized.deployId || null,
    status: normalized.status || null,
    dryRun,
  }, null, 2));

  if (dryRun) {
    console.log("DRY_RUN_INGEST_PAYLOAD", JSON.stringify(ingestPayload, null, 2));
    return;
  }

  const ingestResult = await postToIngest(ingestPayload);

  console.log("INGEST_OK", JSON.stringify({
    httpStatus: ingestResult.status,
    result: ingestResult.body,
  }, null, 2));
}

main().catch((error) => {
  console.error("RENDER_LOG_SOURCE_BRIDGE_FATAL", {
    message: error?.message ? String(error.message) : "unknown_error",
  });
  process.exit(1);
});