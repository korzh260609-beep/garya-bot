function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

export function createCapabilityManifest({ sourceId, domain = null, status = 'implemented', sourceOfTruth = null, sourceRevision = null, supportedTransports = [], capabilities = [] } = {}) {
  return Object.freeze({
    sourceId: text(sourceId, 'sourceId'),
    domain,
    status,
    sourceOfTruth: sourceOfTruth ?? sourceId,
    sourceRevision,
    supportedTransports: Object.freeze([...supportedTransports]),
    capabilities: Object.freeze([...capabilities])
  });
}
