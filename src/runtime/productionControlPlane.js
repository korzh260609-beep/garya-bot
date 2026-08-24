import { createDefaultContractVersioning } from '../contracts/contractVersioning.js';
import { createPostgresContractQuarantineStore } from '../contracts/postgresContractQuarantineStore.js';
import { createDeploymentEventBus } from '../events/deploymentEventBus.js';
import { createBuiltInDomainModules, createDomainRegistry, createDomainRuntime } from '../domains/index.js';

function traceFor(config, traceContext = {}) {
  const correlation = traceContext.traceId ?? traceContext.requestId ?? 'domain-runtime';
  return Object.freeze({
    traceId: traceContext.traceId ?? correlation,
    requestId: traceContext.requestId ?? correlation,
    environment: traceContext.environment ?? config.environment,
    revision: traceContext.revision ?? config.revision
  });
}

function domainSourceResolver(request) {
  if ((request.requirements ?? []).length === 0) return Object.freeze({ available: Object.freeze([]), data: null });
  return Object.freeze({ available: Object.freeze([]), data: null });
}

function domainMemoryResolver() {
  return Object.freeze({ data: null });
}

export function createProductionControlPlane({ persistence = null, observability, config, clock = () => new Date() } = {}) {
  if (!observability?.record) throw new TypeError('observability is required');
  if (!config?.environment || !config?.revision || !config?.projectScope) throw new TypeError('runtime config is required');

  const eventDeployment = createDeploymentEventBus({ persistence, observability, clock });
  const quarantineStore = persistence ? createPostgresContractQuarantineStore(persistence.database) : undefined;
  const contractVersioning = createDefaultContractVersioning({ quarantineStore, observability, clock });
  const domainRegistry = createDomainRegistry(createBuiltInDomainModules());
  const domainRuntime = createDomainRuntime({
    registry: domainRegistry,
    sourceResolver: domainSourceResolver,
    memoryResolver: domainMemoryResolver,
    onEvent(event) {
      observability.record({
        eventClass: 'audit_event',
        channel: 'telemetry',
        stage: 'domain-runtime',
        outcome: event.type.endsWith('.completed') ? 'completed' : 'started',
        traceContext: traceFor(config, event.traceContext),
        data: { domainEventType: event.type, domainId: event.domainId, capability: event.capability }
      });
    }
  });

  return Object.freeze({
    eventBus: eventDeployment.bus,
    eventStore: eventDeployment.store,
    contractVersioning,
    contractQuarantineStore: contractVersioning.quarantineStore,
    domainRegistry,
    domainRuntime
  });
}
