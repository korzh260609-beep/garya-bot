import { createContextBundle, createContextRequest } from '../contracts/memory.js';

function assertProvider(provider) {
  if (!provider || typeof provider.query !== 'function' || typeof provider.write !== 'function') {
    throw new TypeError('memoryProvider must implement query() and write()');
  }
  return provider;
}

function legacyScopeFromMemory2(record, requestScope) {
  if (record?.scope) return record.scope;
  const memoryScope = record?.memoryScope ?? {};
  return Object.freeze({
    userScope: requestScope.userScope,
    projectScope: memoryScope.projectScope ?? requestScope.projectScope,
    groupScope: memoryScope.groupScope ?? requestScope.groupScope ?? null,
    threadScope: memoryScope.threadScope ?? requestScope.threadScope ?? null
  });
}

function contextRecord(record, requestScope) {
  if (record?.scope) return record;
  return Object.freeze({
    id: record.id ?? record.memoryId,
    layer: record.layer,
    key: record.key,
    value: record.value,
    scope: legacyScopeFromMemory2(record, requestScope),
    provenance: {
      sourceType: record.provenance?.sourceType ?? 'memory-2',
      sourceId: record.provenance?.sourceId ?? record.id ?? record.memoryId,
      actorId: record.provenance?.actorId ?? record.memoryScope?.ownerGlobalUserId ?? null
    },
    trust: record.trust ?? 'unverified',
    confirmed: record.confirmed === true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? record.createdAt,
    expiresAt: record.expiresAt ?? null,
    tags: record.tags ?? []
  });
}

export function createContextResolver({ memoryProvider }) {
  const provider = assertProvider(memoryProvider);

  return Object.freeze({
    async resolve(rawRequest) {
      const request = createContextRequest(rawRequest);
      if (request.layers.length === 0) {
        return createContextBundle({
          traceId: request.traceId,
          requestId: request.requestId,
          records: [],
          diagnostics: { requestedLayers: [], returnedCount: 0 }
        });
      }

      const queried = await provider.query({
        scope: request.scope,
        layers: request.layers,
        keys: request.keys,
        now: request.now
      });
      const selected = queried.records.slice(0, request.maxRecords).map((record) => contextRecord(record, request.scope));

      return createContextBundle({
        traceId: request.traceId,
        requestId: request.requestId,
        records: selected,
        diagnostics: {
          requestedLayers: request.layers,
          excludedExpired: queried.diagnostics.excludedExpired,
          excludedScope: queried.diagnostics.excludedScope,
          truncated: queried.records.length > selected.length
        }
      });
    },

    async write(request) {
      return provider.write(request);
    },

    async capture(request) {
      if (typeof provider.capture !== 'function') throw new TypeError('memoryProvider.capture is required for semantic capture');
      return provider.capture(request);
    }
  });
}
