// AGENT NOTE:
// SG 2.0 Render Bridge normalizer.
// Purpose: normalize Render services, deploys, and logs into safe compact structures.
// Do not preserve raw payloads that may contain secrets or unnecessary provider data.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripAnsi(value) {
  const s = typeof value === "string" ? value : "";
  if (!s) return "";

  return s
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B\].*?(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B/g, "");
}

function cleanText(value) {
  const s = stripAnsi(typeof value === "string" ? value : "");
  if (!s) return "";

  return s
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
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
  if (!item || typeof item !== "object" || Array.isArray(item)) return {};

  for (const key of candidates) {
    const value = item[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
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
  return firstNonEmpty(base?.ownerId, item?.ownerId, base?.owner?.id, item?.owner?.id);
}

function extractServiceId(item) {
  const base = unwrapEntity(item, ["service", "resource"]);
  return firstNonEmpty(item?.serviceId, item?.resourceId, item?.service?.id, item?.resource?.id, base?.id);
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
  return cleanText(
    firstNonEmpty(
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
    )
  );
}

function hasWholeWord(text, word) {
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
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
  if (!msg || isBenignErrorNoise(msg)) return false;

  if (hasWholeWord(msg, "error") || hasWholeWord(msg, "exception") || hasWholeWord(msg, "fatal")) {
    return true;
  }

  return [
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
  ].some((token) => msg.includes(token));
}

export function normalizeServices(payload) {
  return toArray(payload)
    .map((item) => {
      const base = unwrapEntity(item, ["service", "resource", "item", "data", "result"]);

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
  return toArray(payload)
    .map((item) => {
      const base = unwrapEntity(item, ["deploy", "resource", "item", "data", "result"]);

      return {
        id: firstNonEmpty(base?.id, item?.id, item?.deployId, base?.deployId),
        status: firstNonEmpty(base?.status, item?.status, item?.state, base?.state, item?.deployStatus, base?.deployStatus),
        createdAt: firstNonEmpty(base?.createdAt, item?.createdAt),
        finishedAt: firstNonEmpty(base?.finishedAt, item?.finishedAt, base?.updatedAt, item?.updatedAt, base?.completedAt, item?.completedAt),
        commit: firstNonEmpty(base?.commit?.id, item?.commit?.id, base?.commitId, item?.commitId, base?.commit?.sha, item?.commit?.sha),
      };
    })
    .filter((item) => item.id || item.status || item.createdAt);
}

export function normalizeLogs(payload) {
  return toArray(payload)
    .map((item) => ({
      timestamp: extractTimestamp(item),
      level: extractLogLevel(item),
      message: extractLogMessage(item),
      serviceId: extractServiceId(item),
    }))
    .filter((item) => item.message);
}

export function filterLogsForService(logs, serviceId) {
  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) return logs;

  const explicit = logs.filter((item) => normalizeString(item.serviceId) === normalizedServiceId);
  return explicit.length ? explicit : logs;
}

export function filterLogsByLevel(logs, level = "error") {
  const normalizedLevel = normalizeString(level).toLowerCase();
  if (!normalizedLevel || normalizedLevel === "all" || normalizedLevel === "*") return logs;

  const strict = logs.filter((item) => {
    const lvl = normalizeString(item.level).toLowerCase();
    if (!lvl) return false;

    if (normalizedLevel === "error") {
      return lvl === "error" || lvl === "fatal" || lvl === "critical";
    }

    return lvl.includes(normalizedLevel);
  });

  if (strict.length) {
    return strict.filter((item) => normalizedLevel !== "error" || !isBenignErrorNoise(item.message));
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

export default {
  normalizeServices,
  normalizeDeploys,
  normalizeLogs,
  filterLogsForService,
  filterLogsByLevel,
  sortLogsNewestFirst,
};
