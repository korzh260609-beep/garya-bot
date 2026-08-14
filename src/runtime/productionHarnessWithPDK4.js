import { createLocalProductionHarness } from './localProductionHarness.js';
import { createProductionDevelopmentKnowledgeDeployment } from '../projectDevelopmentKnowledge/productionDevelopmentKnowledgeDeployment.js';

function mergeHealth(base, pdk4) {
  return Object.freeze({ ...base, pdk4: Object.freeze({ ...pdk4 }) });
}

export function createProductionHarnessWithPDK4({ env = {}, interpretationResolver, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const base = createLocalProductionHarness({ env, interpretationResolver, fetchImpl, clock });
  const pdk4Deployment = createProductionDevelopmentKnowledgeDeployment({ harness: base, env, fetchImpl, clock });
  const baseRuntime = base.runtime;
  const runtime = Object.freeze({
    async start() {
      const started = await baseRuntime.start();
      await pdk4Deployment.start();
      return mergeHealth(started, pdk4Deployment.health());
    },
    async stop() {
      try { await pdk4Deployment.stop(); } finally { await baseRuntime.stop(); }
    },
    handle: (input) => baseRuntime.handle(input),
    health: () => mergeHealth(baseRuntime.health(), pdk4Deployment.health()),
    readiness: () => {
      const readiness = baseRuntime.readiness();
      return Object.freeze({ ...readiness, pdk4: pdk4Deployment.health() });
    }
  });
  return Object.freeze({ ...base, runtime, pdk4Deployment });
}
