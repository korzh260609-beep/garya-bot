// src/integrations/render/RenderBridgeNormalizer.js

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.logs)) return payload.logs;
  if (Array.isArray(payload.services)) return payload.services;
  if (Array.isArray(payload.deploys)) return payload.deploys;
  if (Array.isArray(payload.resources)) return payload.resources;

  return [payload];
}

function unwrapEntity(item, candidates = []) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {};
  }

  for (const key of candidates) {
    const value = item[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
  }

  return item;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const s = normalizeString(value);
    if (s) return s;
  }
  return "";
}

function extractOwnerId(item) {
  const base = unwrapEntity(item, ["service", "resource", "item", "data", "result"]);
  return firstNonEmpty(
    base?.ownerId,
    item?.ownerId,
    base?.owner?.id,
    item?.owner?.id
  );
}

function extractServiceId(item) {
  const base = unwrapEntity(item, ["service", "resource"]);
  return firstNonEmpty(
    item?.serviceId,
    item?.resourceId,
    item?.service?.id,
    item?.resource?.id,
    base?.id
  );
}

function extractTimestamp(item) {
  const base = unwrapEntity(item, ["log", "event", "entry"]);
  return firstNonEmpty(
    item?.timestamp,
    item?.createdAt,
    item?.time,
    item?.ts,
    item?.occurredAt,
    base?.timestamp,
    base?.createdAt,
    base?.time,
    base?.occurredAt
  );
}

function extractLogLevel(item) {
  const base = unwrapEntity(item, ["log", "event", "entry"]);
  return firstNonEmpty(
    item?.level,
    item?.severity,
    item?.labels?.level,
    item?.attributes?.level,
    base?.level,
    base?.severity,
    base?.labels?.level,
    base?.attributes?.level
  ).toLowerCase();
}

function extractLogMessage(item) {
  const base = unwrapEntity(item, ["log", "event", "entry"]);
  return firstNonEmpty(
    item?.message,
    item?.msg,
    item?.text,
    item?.line,
    item?.body,
    base?.message,
    base?.msg,
    base?.text,
    base?.line,
    base?.body
  );
}

function hasWholeWord(text, word) {
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(text);
}

function includesAny(text, tokens = []) {
  return tokens.some((token) => text.includes(token));
}

function isBenignErrorNoise(message) {
  const msg = normalizeString(message).toLowerCase();
  if (!msg) return false;

  return (
    msg.includes("error_events") ||
    msg.includes("boot cleanup: skipped") ||
    msg.includes("retention handled by service")
  );
}

function looksLikeRealErrorMessage(message) {
  const msg = normalizeString(message).toLowerCase();
  if (!msg) return false;

  if (isBenignErrorNoise(msg)) {
    return false;
  }

  if (
    hasWholeWord(msg, "error") ||
    hasWholeWord(msg, "exception") ||
    hasWholeWord(msg, "fatal")
  ) {
    return true;
  }

  return includesAny(msg, [
    "syntaxerror",
    "typeerror",
    "referenceerror",
    "rangeerror",
    "urierror",
    "evalerror",
    "aggregateerror",
    "unhandled rejection",
    "unhandledrejection",
    "uncaught exception",
    "cannot read properties of",
    "cannot set properties of",
    "is not defined",
    "failed to",
    "crash",
    "crashed",
    "panic",
  ]);
}

export function normalizeServices(payload) {
  const items = toArray(payload);

  return items
    .map((item) => {
      const base = unwrapEntity(item, [
        "service",
        "resource",
        "item",
        "data",
        "result",
      ]);

      return {
        id: firstNonEmpty(base?.id, item?.id),
        ownerId: extractOwnerId(item),
        name: firstNonEmpty(base?.name, item?.name, base?.serviceName),
        slug: firstNonEmpty(base?.slug, item?.slug),
        type: firstNonEmpty(base?.type, item?.type),
        region: firstNonEmpty(base?.region, item?.region),
        url: firstNonEmpty(
          base?.url,
          item?.url,
          base?.dashboardUrl,
          item?.dashboardUrl,
          base?.serviceDetails?.url,
          item?.serviceDetails?.url
        ),
        suspended:
          typeof base?.suspended === "boolean"
            ? base.suspended
            : typeof item?.suspended === "boolean"
              ? item.suspended
              : undefined,
      };
    })
    .filter((item) => item.id || item.name || item.slug);
}

export function normalizeDeploys(payload) {
  const items = toArray(payload);

  return items
    .map((item) => {
      const base = unwrapEntity(item, [
        "deploy",
        "resource",
        "item",
        "data",
        "result",
      ]);

      return {
        id: firstNonEmpty(base?.id, item?.id, item?.deployId, base?.deployId),
        status: firstNonEmpty(
          base?.status,
          item?.status,
          item?.state,
          base?.state,
          item?.deployStatus,
          base?.deployStatus
        ),
        createdAt: firstNonEmpty(base?.createdAt, item?.createdAt),
        finishedAt: firstNonEmpty(
          base?.finishedAt,
          item?.finishedAt,
          base?.updatedAt,
          item?.updatedAt,
          base?.completedAt,
          item?.completedAt
        ),
        commit: firstNonEmpty(
          base?.commit?.id,
          item?.commit?.id,
          base?.commitId,
          item?.commitId,
          base?.commit?.sha,
          item?.commit?.sha
        ),
      };
    })
    .filter((item) => item.id || item.status || item.createdAt);
}

export function normalizeLogs(payload) {
  const items = toArray(payload);

  return items
    .map((item) => ({
      timestamp: extractTimestamp(item),
      level: extractLogLevel(item),
      message: extractLogMessage(item),
      serviceId: extractServiceId(item),
      raw: item,
    }))
    .filter((item) => item.message);
}

export function filterLogsForService(logs, serviceId) {
  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) return logs;

  const withExplicitService = logs.filter(
    (item) => normalizeString(item.serviceId) === normalizedServiceId
  );

  if (withExplicitService.length) {
    return withExplicitService;
  }

  return logs;
}

export function filterLogsByLevel(logs, level = "error") {
  const normalizedLevel = normalizeString(level).toLowerCase();
  if (!normalizedLevel) return logs;

  const strictLevelMatched = logs.filter((item) => {
    const lvl = normalizeString(item.level).toLowerCase();
    if (!lvl) return false;

    if (normalizedLevel === "error") {
      return lvl === "error" || lvl === "fatal" || lvl === "critical";
    }

    return lvl.includes(normalizedLevel);
  });

  if (strictLevelMatched.length) {
    return strictLevelMatched.filter((item) => {
      if (normalizedLevel !== "error") return true;
      return !isBenignErrorNoise(item.message);
    });
  }

  if (normalizedLevel === "error") {
    return logs.filter((item) => looksLikeRealErrorMessage(item.message));
  }

  return logs;
}

export function sortLogsNewestFirst(logs) {
  return [...logs].sort((a, b) => {
    const ta = Date.parse(a.timestamp || "") || 0;
    const tb = Date.parse(b.timestamp || "") || 0;
    return tb - ta;
  });
}

export function buildErrorSnapshotFromLogs({
  logs,
  sourceKey = "render_primary",
  service,
  level = "error",
  minutes = 60,
}) {
  const lines = logs.map((item) => {
    const ts = item.timestamp || "-";
    const lvl = item.level || "-";
    return `[${ts}] [${lvl}] ${item.message}`;
  });

  return {
    sourceKey,
    mode: "error",
    logText: lines.join("\n"),
    meta: {
      bridge: "render_rest_api_v1",
      serviceId: service?.id || null,
      serviceName: service?.name || null,
      serviceSlug: service?.slug || null,
      ownerId: service?.ownerId || null,
      requestedLevel: level,
      requestedWindowMinutes: minutes,
      lines: logs.length,
    },
  };
}

export function buildDeploySnapshotFromDeploy({
  deploy,
  sourceKey = "render_primary",
  service,
}) {
  const deployId = deploy?.id || "unknown_deploy";
  const status = deploy?.status || "unknown";

  const logText = [
    `Deploy ID: ${deployId}`,
    `Status: ${status}`,
    `Created At: ${deploy?.createdAt || "-"}`,
    `Finished At: ${deploy?.finishedAt || "-"}`,
    `Commit: ${deploy?.commit || "-"}`,
    `Service: ${service?.name || service?.slug || service?.id || "-"}`,
  ].join("\n");

  return {
    sourceKey,
    mode: "deploy",
    deployId,
    status,
    logText,
    meta: {
      bridge: "render_rest_api_v1",
      serviceId: service?.id || null,
      serviceName: service?.name || null,
      serviceSlug: service?.slug || null,
      ownerId: service?.ownerId || null,
    },
  };
}

export default {
  normalizeServices,
  normalizeDeploys,
  normalizeLogs,
  filterLogsForService,
  filterLogsByLevel,
  sortLogsNewestFirst,
  buildErrorSnapshotFromLogs,
  buildDeploySnapshotFromDeploy,
};