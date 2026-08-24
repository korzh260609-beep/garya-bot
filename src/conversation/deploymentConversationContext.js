import { createConversationContextService, createInMemoryConversationContextStore } from './conversationContextService.js';
import { createPostgresConversationContextStore } from './postgresConversationContextStore.js';

function auditAdapter(observability, config) {
  let sequence = 0;
  return async (event) => {
    sequence += 1;
    const correlation = `conversation-${sequence}`;
    return observability.record({ ...event, eventClass: 'audit_event', traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision }, reason: event.data?.reason ?? null, data: { ...(event.data ?? {}), conversationEventClass: event.eventClass } });
  };
}

export function createDeploymentConversationContext({ persistence = null, observability, config, clock = () => new Date(), maxRecentTurns = 12 } = {}) {
  if (!observability?.record) throw new TypeError('observability is required');
  if (!config?.projectScope) throw new TypeError('config.projectScope is required');
  const rawStore = persistence ? createPostgresConversationContextStore({ database: persistence.database }) : createInMemoryConversationContextStore();
  const service = createConversationContextService({ store: rawStore, clock, maxRecentTurns, audit: auditAdapter(observability, config) });
  const store = Object.freeze({ ...rawStore, retrieveHistory: (...args) => service.retrieveHistory(...args) });
  return Object.freeze({ service, store });
}
