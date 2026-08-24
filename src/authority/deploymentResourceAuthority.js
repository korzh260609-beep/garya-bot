import { createResourceAuthorityRegistry, createInMemoryResourceAuthorityStore } from './resourceAuthorityRegistry.js';
import { createPostgresResourceAuthorityStore } from './postgresResourceAuthorityStore.js';

function auditAdapter(observability, config) {
  let sequence = 0;
  return async (event) => {
    sequence += 1;
    const correlation = `authority-${sequence}`;
    return observability.record({
      ...event,
      eventClass: 'audit_event',
      traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision },
      reason: event.data?.reason ?? null,
      data: { ...(event.data ?? {}), authorityEventClass: event.eventClass }
    });
  };
}

export function createDeploymentResourceAuthority({ persistence = null, connectionRegistry = null, observability, config, clock = () => new Date() } = {}) {
  if (!observability?.record) throw new TypeError('observability is required');
  if (!config?.projectScope) throw new TypeError('config.projectScope is required');
  const store = persistence ? createPostgresResourceAuthorityStore({ database: persistence.database }) : createInMemoryResourceAuthorityStore();
  const registry = createResourceAuthorityRegistry({ store, connectionRegistry, clock, audit: auditAdapter(observability, config) });
  const actor = Object.freeze({
    globalUserId: 'system:runtime',
    roles: Object.freeze(['system']),
    grants: Object.freeze(['resource-authority:manage','resource-authority:read','connection:read','connection:manage:any'])
  });
  const accessContext = Object.freeze({ actor, projectScope: config.projectScope });
  return Object.freeze({ registry, store, accessContext });
}
