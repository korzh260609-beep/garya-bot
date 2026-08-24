import { createLocalTransportAdapter } from './adapters.js';
import { createInterfaceRegistry } from './interfaceRegistry.js';

export function createLocalInterfaceHarness({ identityResolver, requestHandler } = {}) {
  const deliveries = [];
  const adapter = createLocalTransportAdapter({
    identityResolver,
    requestHandler,
    responseDeliverer: async (delivery) => deliveries.push(delivery),
    environment: 'test',
    revision: 'block-8'
  });
  const registry = createInterfaceRegistry([adapter]);

  return Object.freeze({
    registry,
    deliveries,
    async send(input) {
      return registry.receive('local', input);
    }
  });
}
