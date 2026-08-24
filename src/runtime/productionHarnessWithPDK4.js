import { createLocalProductionHarness } from './localProductionHarness.js';
import { createProductionDevelopmentKnowledgeDeployment } from '../projectDevelopmentKnowledge/productionDevelopmentKnowledgeDeployment.js';

function mergeHealth(base, pdk4) {
  return Object.freeze({
    ...base,
    pdk4: Object.freeze({ ...pdk4 })
  });
}

function wireRepositoryReadCapability(base, pdk4Deployment) {
  const repositoryReadService = pdk4Deployment.repositoryReadService;
  if (!repositoryReadService) return null;
  const registered = base.capabilityRegistry.get('repository-analyze');
  if (!registered) throw new Error('repository-analyze capability is not registered');
  return base.capabilityRegistry.replace({
    ...registered,
    execute: async (request) => {
      const snapshot = await repositoryReadService.snapshot({
        query: request.input?.text ?? request.input?.message ?? null,
        files: request.input?.files ?? []
      });
      if (snapshot?.mutated === true || snapshot?.pushed === true || snapshot?.published === true) {
        throw new Error('read-only repository service attempted mutation');
      }
      return {
        status: 'success',
        data: {
          ...snapshot,
          mode: request.input?.mode === 'prepare-only' ? 'prepare-only' : 'read-only',
          mutated: false,
          message: 'Verified repository snapshot retrieved for response composition'
        },
        sources: snapshot.sources,
        tools: ['repository-analyzer']
      };
    }
  });
}

export function createProductionHarnessWithPDK4({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const base = createLocalProductionHarness({ env, interpretationResolver, fetchImpl, clock });
  const pdk4Deployment = createProductionDevelopmentKnowledgeDeployment({ harness: base, env, fetchImpl, clock });
  const repositoryReadCapability = wireRepositoryReadCapability(base, pdk4Deployment);
  const baseRuntime = base.runtime;
  const runtime = Object.freeze({
    async start() {
      const started = await baseRuntime.start();
      try {
        await pdk4Deployment.start();
      } catch (error) {
        try { await pdk4Deployment.stop(); } catch {}
        try { await baseRuntime.stop(); } catch {}
        throw error;
      }
      return mergeHealth(started, pdk4Deployment.health());
    },
    async stop() {
      try {
        await pdk4Deployment.stop();
      } finally { await baseRuntime.stop(); }
    },
    handle: (input) => baseRuntime.handle(input),
    health: () => mergeHealth(baseRuntime.health(), pdk4Deployment.health()),
    readiness: () => {
      const readiness = baseRuntime.readiness();
      return Object.freeze({ ...readiness, pdk4: pdk4Deployment.health() });
    }
  });

  return Object.freeze({
    ...base,
    runtime,
    pdk4Deployment,
    repositoryReadCapability
  });
}
