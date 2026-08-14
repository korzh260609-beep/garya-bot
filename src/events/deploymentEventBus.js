import { createInternalEventBus } from './internalEventBus.js';
import { createInMemoryEventStore } from './inMemoryEventStore.js';
import { createPostgresEventStore } from './postgresEventStore.js';

export function createDeploymentEventBus({ persistence = null, observability = null, clock = () => new Date(), idFactory, retryDelayMs, processingTimeoutMs, workerIntervalMs } = {}) {
  const store = persistence ? createPostgresEventStore({ database: persistence.database }) : createInMemoryEventStore();
  const bus = createInternalEventBus({ store, observability, clock, idFactory, retryDelayMs, processingTimeoutMs, workerIntervalMs });
  return Object.freeze({ bus, store });
}
