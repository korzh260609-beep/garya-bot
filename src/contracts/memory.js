const LAYERS = Object.freeze([
  'session',
  'user-memory',
  'user-group-memory',
  'group-memory',
  'thread-memory',
  'project-memory',
  'dialogue-archive',
  'topic-digest',
  'external-evidence',
  'runtime-state'
]);

const TRUST_LEVELS = Object.freeze(['unverified', 'reported', 'confirmed', 'verified']);

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalString(value, field) {
  return value == null ? null : requireString(value, field);
}

function requireLayer(value) {
  const layer = requireString(value, 'layer');
  if (!LAYERS.includes(layer)) throw new TypeError(`unsupported memory layer: ${layer}`);
  return layer;
}

function freezeScope(scope) {
  requireObject(scope, 'scope');
  const frozen = Object.freeze({
    userScope: requireString(scope.userScope, 'scope.userScope'),
    projectScope: requireString(scope.projectScope, 'scope.projectScope'),
    groupScope: optionalString(scope.groupScope, 'scope.groupScope'),
    threadScope: optionalString(scope.threadScope, 'scope.threadScope')
  });
  if (frozen.threadScope && !frozen.groupScope) throw new TypeError('thread scope requires group scope');
  return frozen;
}

export function memoryLayers() {
  return LAYERS;
}

export function createMemoryRecord(input) {
  requireObject(input, 'memory record');
  const trust = requireString(input.trust ?? 'unverified', 'trust');
  if (!TRUST_LEVELS.includes(trust)) throw new TypeError(`unsupported trust level: ${trust}`);
  const createdAt = requireString(input.createdAt, 'createdAt');
  const expiresAt = optionalString(input.expiresAt, 'expiresAt');
  if (Number.isNaN(Date.parse(createdAt)) || (expiresAt && Number.isNaN(Date.parse(expiresAt)))) {
    throw new TypeError('createdAt and expiresAt must be valid ISO timestamps');
  }

  return Object.freeze({
    id: requireString(input.id, 'id'),
    layer: requireLayer(input.layer),
    key: requireString(input.key, 'key'),
    value: input.value,
    scope: freezeScope(input.scope),
    provenance: Object.freeze({
      sourceType: requireString(input.provenance?.sourceType, 'provenance.sourceType'),
      sourceId: requireString(input.provenance?.sourceId, 'provenance.sourceId'),
      actorId: optionalString(input.provenance?.actorId, 'provenance.actorId')
    }),
    trust,
    confirmed: Boolean(input.confirmed),
    createdAt,
    updatedAt: requireString(input.updatedAt ?? createdAt, 'updatedAt'),
    expiresAt,
    tags: Object.freeze([...(input.tags ?? [])].map((tag) => requireString(tag, 'tag')))
  });
}

export function createMemoryWriteRequest(input) {
  requireObject(input, 'memory write request');
  const layer = requireLayer(input.layer);
  const confirmed = Boolean(input.confirmed);
  if ((layer === 'user-memory' || layer === 'project-memory') && !confirmed) {
    throw new TypeError('confirmed memory layers require confirmed=true');
  }
  if (layer === 'dialogue-archive' && confirmed) {
    throw new TypeError('dialogue archive cannot be written as confirmed memory');
  }

  return Object.freeze({
    layer,
    key: requireString(input.key, 'key'),
    value: input.value,
    scope: freezeScope(input.scope),
    provenance: Object.freeze({
      sourceType: requireString(input.provenance?.sourceType, 'provenance.sourceType'),
      sourceId: requireString(input.provenance?.sourceId, 'provenance.sourceId'),
      actorId: optionalString(input.provenance?.actorId, 'provenance.actorId')
    }),
    trust: requireString(input.trust ?? (confirmed ? 'confirmed' : 'reported'), 'trust'),
    confirmed,
    expiresAt: optionalString(input.expiresAt, 'expiresAt'),
    tags: Object.freeze([...(input.tags ?? [])].map((tag) => requireString(tag, 'tag')))
  });
}

export function createContextRequest(input) {
  requireObject(input, 'context request');
  const layers = [...new Set((input.layers ?? []).map(requireLayer))];
  const maxRecords = Number(input.maxRecords ?? 20);
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 100) {
    throw new TypeError('maxRecords must be an integer between 1 and 100');
  }
  return Object.freeze({
    traceId: requireString(input.traceId, 'traceId'),
    requestId: requireString(input.requestId, 'requestId'),
    scope: freezeScope(input.scope),
    layers: Object.freeze(layers),
    keys: Object.freeze([...(input.keys ?? [])].map((key) => requireString(key, 'key'))),
    maxRecords,
    now: requireString(input.now ?? new Date().toISOString(), 'now')
  });
}

export function createContextBundle(input) {
  requireObject(input, 'context bundle');
  const records = Object.freeze([...(input.records ?? [])].map(createMemoryRecord));
  return Object.freeze({
    traceId: requireString(input.traceId, 'traceId'),
    requestId: requireString(input.requestId, 'requestId'),
    records,
    diagnostics: Object.freeze({
      requestedLayers: Object.freeze([...(input.diagnostics?.requestedLayers ?? [])]),
      returnedCount: records.length,
      excludedExpired: Number(input.diagnostics?.excludedExpired ?? 0),
      excludedScope: Number(input.diagnostics?.excludedScope ?? 0),
      truncated: Boolean(input.diagnostics?.truncated)
    })
  });
}
