// AGENT NOTE:
// SG 2.0 simple Render latest logs collector.
// Purpose: collect the latest N Render logs from the configured Render service.
// Do not add GitHub writes, polling, Telegram handlers, deploys, restarts, or env mutation here.

import renderBridgeClient from "./renderBridgeClient.js";
import { getRenderBridgeDiag } from "./renderBridgeConfig.js";
import { sanitizeRenderLogs } from "./renderSanitizer.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
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

export async function collectLatestRenderLogs({ limit = 100, target = "garya-bot", level = "all" } = {}) {
  const safeLimit = clampLimit(limit, 100);
  const safeTarget = normalizeString(target || "garya-bot") || "garya-bot";
  const safeLevel = normalizeString(level || "all") || "all";
  const diag = getRenderBridgeDiag();

  const services = await renderBridgeClient.listServices({ filter: safeTarget });
  const service =
    services.find((item) => serviceMatchesTarget(item, safeTarget)) ||
    (services.length === 1 ? services[0] : null);

  if (!service?.id) {
    throw new Error("render_logs_service_not_found");
  }

  const logs = await renderBridgeClient.listLogsByCount({
    ownerId: service.ownerId,
    serviceId: service.id,
    level: safeLevel,
    limit: safeLimit,
  });

  return {
    ok: true,
    type: "render_latest_logs",
    generated_at: new Date().toISOString(),
    target: safeTarget,
    limit: safeLimit,
    level: safeLevel,
    bridge: {
      ready: Boolean(diag.ready),
      enabled: Boolean(diag.enabled),
      has_api_key: Boolean(diag.hasApiKey),
    },
    service: {
      id: service.id || "",
      name: service.name || "",
      slug: service.slug || "",
      ownerId: service.ownerId || "",
    },
    logs_count: logs.length,
    logs: sanitizeRenderLogs(logs),
    secrets_policy: "env_values_never_exposed",
  };
}

export default {
  collectLatestRenderLogs,
};
