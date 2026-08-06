import { createContextBundle, createContextRequest } from '../contracts/memory.js';

function assertProvider(provider) {
  if (!provider || typeof provider.query !== 'function' || typeof provider.write !== 'function') {
    throw new TypeError('memoryProvider must implement query() and write()');
  }
  return provider;
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
      const selected = queried.records.slice(0, request.maxRecords);

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
    }
  });
}
