// src/integrations/render/RenderBridgeNormalizer.js

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.logs)) return payload.logs;
  if (Array.isArray(payload.services)) return payload.services;
  if (Array.isArray(payload.deploys)) return payload.deploys;
  return [];
}

function extractServiceId(item) {
  return (
    normalizeString(item?.serviceId) ||
    normalizeString(item?.resourceId) ||
    normalizeString(item?.service?.id) ||
    normalizeString(item?.resource?.id) ||
    ""
  );
}

function extractTimestamp(item) {
  return (
    normalizeString(item?.timestamp) ||
    normalizeString(item?.createdAt) ||
    normalizeString(item?.time) ||
    normalizeString(item?.ts) ||
    normalizeString(item?.occurredAt) ||
    ""
  );
}

function extractLogLevel(item) {
  return (
    normalizeString(item?.level).toLowerCase() ||
    normalizeString(item?.severity).toLowerCase() ||
    normalizeString(item?.labels?.level).toLowerCase() ||
    normalizeString(item?.attributes?.level).toLowerCase() ||
    ""
  );
}

function extractLogMessage(item) {
  return (
    normalizeString(item?.message) ||
    normalizeString(item?.msg) ||
    normalizeString(item?.text) ||
    normalizeString(item?.line) ||
    normalizeString(item?.body) ||
    ""
  );
}

export function normalizeServices(payload) {
  const items = toArray(payload);

  return items.map((item) => ({
    id: normalizeString(item?.id),
    name: normalizeString(item?.name),
    slug: normalizeString(item?.slug),
    type: normalizeString(item?.type),
    region: normalizeString(item?.region),
    url: normalizeString(item?.url),
    suspended: item?.suspended,
  }));
}

export function normalizeDeploys(payload) {
  const items = toArray(payload);

  return items.map((item) => ({
    id:
      normalizeString(item?.id) ||
      normalizeString(item?.deployId) ||
      normalizeString(item?.deploy?.id),
    status:
      normalizeString(item?.status) ||
      normalizeString(item?.state) ||
      normalizeString(item?.deployStatus),
    createdAt: normalizeString(item?.createdAt),
    finishedAt:
      normalizeString(item?.finishedAt) ||
      normalizeString(item?.updatedAt) ||
      normalizeString(item?.completedAt),
    commit:
      normalizeString(item?.commit?.id) ||
      normalizeString(item?.commitId) ||
      normalizeString(item?.commit?.sha),
  }));
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

  const matched = logs.filter((item) =>
    normalizeString(item.level).toLowerCase().includes(normalizedLevel)
  );

  if (matched.length) {
    return matched;
  }

  if (normalizedLevel === "error") {
    return logs.filter((item) => {
      const msg = normalizeString(item.message).toLowerCase();
      return (
        msg.includes("error") ||
        msg.includes("exception") ||
        msg.includes("syntaxerror") ||
        msg.includes("typeerror") ||
        msg.includes("referenceerror") ||
        msg.includes("fatal")
      );
    });
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