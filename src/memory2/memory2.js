export * from './memory2Core.js';
import { createMemory2Service as createMemory2CoreService } from './memory2Core.js';
import { bindNextProductionAIRouter } from '../ai/runtimeAIRouterBinding.js';
import { rerankAuthorizedMemoryRecall, MEMORY2_HYBRID_SEMANTIC_LIMITS } from './hybridSemanticRecall.js';

function validRouter(value) { return value?.route && typeof value.route === 'function' ? value : null; }

export function createMemory2Service(input = {}) {
  const { aiRouter = null, ...coreInput } = input;
  const coreService = createMemory2CoreService(coreInput);
  let semanticRouter = validRouter(aiRouter);
  if (!semanticRouter) bindNextProductionAIRouter((router) => { semanticRouter = validRouter(router); });

  async function recall(args = {}) {
    const fallback = await coreService.recall(args);
    const query = String(args.query ?? '').trim();
    if (!semanticRouter || !query || fallback.records.length === 0) return fallback;
    try {
      const candidateResult = await coreService.recall({
        ...args,
        maxRecords: MEMORY2_HYBRID_SEMANTIC_LIMITS.maxCandidates,
        maxCharacters: 100000
      });
      return await rerankAuthorizedMemoryRecall({
        aiRouter: semanticRouter,
        query,
        candidateResult,
        maxRecords: args.maxRecords ?? 20,
        maxCharacters: args.maxCharacters ?? 12000,
        trace: args.traceContext ?? null
      });
    } catch {
      return fallback;
    }
  }

  return Object.freeze({ ...coreService, recall });
}
