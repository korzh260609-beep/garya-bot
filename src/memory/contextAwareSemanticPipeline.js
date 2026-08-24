import { createContextRequest, memoryLayers } from '../contracts/memory.js';

function normalizeRequestedLayers(contextNeeds) {
  const allowed = new Set(memoryLayers());
  return [...new Set((contextNeeds ?? []).filter((item) => allowed.has(item)))];
}

export function createContextAwareSemanticPipeline({ semanticKernel, contextResolver }) {
  if (!semanticKernel || typeof semanticKernel.process !== 'function') {
    throw new TypeError('semanticKernel must implement process()');
  }
  if (!contextResolver || typeof contextResolver.resolve !== 'function') {
    throw new TypeError('contextResolver must implement resolve()');
  }

  return Object.freeze({
    async process(input) {
      const initial = await semanticKernel.process(input);
      const requestedLayers = normalizeRequestedLayers(initial.interpretation.contextNeeds);
      const request = createContextRequest({
        traceId: initial.canonicalInput.traceContext.traceId,
        requestId: initial.canonicalInput.traceContext.requestId,
        scope: initial.canonicalInput.scopeContext,
        layers: requestedLayers,
        keys: [],
        maxRecords: 20
      });
      const contextBundle = await contextResolver.resolve(request);

      if (contextBundle.records.length === 0) {
        return Object.freeze({ ...initial, contextBundle });
      }

      const enrichedInput = {
        ...input,
        metadata: {
          ...(input.metadata ?? {}),
          contextBundle
        }
      };
      const enriched = await semanticKernel.process(enrichedInput);
      return Object.freeze({ ...enriched, contextBundle });
    }
  });
}
