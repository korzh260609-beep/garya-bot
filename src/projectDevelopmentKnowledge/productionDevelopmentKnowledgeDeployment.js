import { loadProductionDevelopmentKnowledgeConfig } from './productionDevelopmentKnowledgeConfig.js';
import { registerProductionDevelopmentKnowledgeCredential } from './productionDevelopmentKnowledgeCredential.js';
import { createProductionDevelopmentKnowledgeRuntime } from './productionDevelopmentKnowledgeRuntime.js';

function disabledHealth(config) {
  return Object.freeze({ enabled: false, phase: 'disabled', healthy: true, projectKey: config.projectKey, repository: config.repository, branch: config.branch });
}

export function createProductionDevelopmentKnowledgeDeployment({ harness, env = process.env, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  if (!harness?.config) throw new TypeError('production harness is required');
  const config = loadProductionDevelopmentKnowledgeConfig(env, { defaultProjectKey: harness.config.projectScope });
  if (!config.enabled) {
    return Object.freeze({
      config,
      credential: Object.freeze({ registered: false, credentialId: config.credentialId, tokenKey: null }),
      runtime: null,
      start: async () => disabledHealth(config),
      stop: async () => disabledHealth(config),
      health: () => disabledHealth(config),
      inspect: async () => Object.freeze({ productionRuntime: disabledHealth(config) }),
      reconcile: async () => Object.freeze({ status: 'disabled', health: disabledHealth(config) })
    });
  }
  if (!harness.persistence?.database || !harness.projectMemoryStore) throw new Error('PDK4 production runtime requires PostgreSQL Project Memory');
  const credential = registerProductionDevelopmentKnowledgeCredential({
    credentialManager: harness.credentialManager,
    env,
    projectScope: config.projectKey,
    credentialId: config.credentialId
  });
  const runtime = createProductionDevelopmentKnowledgeRuntime({
    config,
    database: harness.persistence.database,
    projectMemoryStore: harness.projectMemoryStore,
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    aiRouter: harness.productionAI?.aiRouter ?? null,
    fetchImpl,
    observability: harness.observability,
    clock
  });
  return Object.freeze({ config, credential, runtime, start: runtime.start, stop: runtime.stop, health: runtime.health, inspect: runtime.inspect, reconcile: runtime.reconcile });
}
