// AGENT NOTE:
// SG 2.0 Render normalizer skeleton.
// Purpose: normalize Render services, deploys, and logs before agents consume them.
// Do not expose secrets or raw env data from Render responses.

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

export function normalizeRenderService(raw = {}) {
  const service = raw?.service && typeof raw.service === "object" ? raw.service : raw;

  return {
    id: firstNonEmpty(service.id, service.serviceId),
    ownerId: firstNonEmpty(service.ownerId, service.owner?.id),
    name: firstNonEmpty(service.name, service.serviceName),
    slug: firstNonEmpty(service.slug),
    type: firstNonEmpty(service.type),
    region: firstNonEmpty(service.region),
  };
}

export function normalizeRenderServices(raw) {
  return asArray(raw)
    .map(normalizeRenderService)
    .filter((service) => service.id || service.name || service.slug);
}

export function normalizeRenderDeploy(raw = {}) {
  const deploy = raw?.deploy && typeof raw.deploy === "object" ? raw.deploy : raw;

  return {
    id: firstNonEmpty(deploy.id, deploy.deployId),
    status: firstNonEmpty(deploy.status, deploy.state) || "unknown",
    commit: firstNonEmpty(deploy.commit?.id, deploy.commit?.sha, deploy.commitId),
    createdAt: firstNonEmpty(deploy.createdAt, deploy.created_at),
    finishedAt: firstNonEmpty(deploy.finishedAt, deploy.updatedAt, deploy.finished_at, deploy.updated_at),
  };
}

export function normalizeRenderDeploys(raw) {
  return asArray(raw)
    .map(normalizeRenderDeploy)
    .filter((deploy) => deploy.id || deploy.status !== "unknown" || deploy.commit);
}

export function normalizeRenderLog(raw = {}) {
  return {
    timestamp: firstNonEmpty(raw.timestamp, raw.time, raw.createdAt, raw.created_at),
    level: firstNonEmpty(raw.level, raw.severity) || "unknown",
    message: firstNonEmpty(raw.message, raw.text, raw.body),
    serviceId: firstNonEmpty(raw.serviceId, raw.resource, raw.resourceId),
    deployId: firstNonEmpty(raw.deployId, raw.deploy?.id),
  };
}

export function normalizeRenderLogs(raw) {
  return asArray(raw)
    .map(normalizeRenderLog)
    .filter((log) => log.timestamp || log.message);
}

export default {
  normalizeRenderService,
  normalizeRenderServices,
  normalizeRenderDeploy,
  normalizeRenderDeploys,
  normalizeRenderLog,
  normalizeRenderLogs,
};
