import { createDeliveryRouter, createDeliveryTransportRegistry, createInMemoryDeliveryStore } from './deliveryRouter.js';
import { createPostgresDeliveryStore } from './postgresDeliveryStore.js';

export function createDeploymentDeliveryRouter({ persistence = null, userSettingsService, resourceAuthorityRegistry, connectionRegistry, connectionAccessContext = null, observability, clock = () => new Date(), timeoutMs = 10_000, maxAttempts = 3, fallbackTransports = [] } = {}) {
  const store = persistence ? createPostgresDeliveryStore({ database: persistence.database }) : createInMemoryDeliveryStore();
  const transportRegistry = createDeliveryTransportRegistry();
  const router = createDeliveryRouter({ store, transportRegistry, userSettingsService, resourceAuthorityRegistry, connectionRegistry, connectionAccessContext, observability, clock, timeoutMs, maxAttempts, fallbackTransports });
  return Object.freeze({ router, store, transportRegistry });
}
