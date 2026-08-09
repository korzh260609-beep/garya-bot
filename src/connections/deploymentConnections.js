import { createExternalConnectionsRegistry, createInMemoryExternalConnectionStore, ExternalConnectionError } from './externalConnectionsRegistry.js';
import { createPostgresExternalConnectionStore } from './postgresExternalConnectionStore.js';

function auditAdapter(observability, config) {
  let sequence = 0;
  return async (event) => {
    sequence += 1;
    const correlation = `connection-${sequence}`;
    return observability.record({ ...event, eventClass: 'audit_event', traceContext: { traceId: correlation, requestId: correlation, environment: config.environment, revision: config.revision }, reason: event.data?.reason ?? null, data: { ...(event.data ?? {}), connectionEventClass: event.eventClass } });
  };
}

export function createDeploymentExternalConnections({ persistence = null, credentialManager, observability, config, env = {}, clock = () => new Date() } = {}) {
  if (!credentialManager || typeof credentialManager.listCredentials !== 'function') throw new TypeError('credentialManager is required');
  const store = persistence ? createPostgresExternalConnectionStore({ database: persistence.database }) : createInMemoryExternalConnectionStore();
  const registry = createExternalConnectionsRegistry({ store, clock, audit: auditAdapter(observability, config), credentialManager });
  const actor = Object.freeze({ globalUserId: 'system:runtime', roles: Object.freeze(['system']), grants: Object.freeze(['connection:manage','connection:read','connection:verify','connection:manage:any']) });
  const accessContext = Object.freeze({ actor, projectScope: config.projectScope });

  function descriptors() {
    const credentialIds = new Set(credentialManager.listCredentials().map((item) => item.credentialId));
    const items = [];
    if (credentialIds.has('sg.openai.primary')) items.push({ connectionId: 'openai', provider: 'openai', serviceType: 'ai-provider', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope, externalAccountId: 'primary', externalAccount: { label: 'OpenAI primary' }, credentialId: 'sg.openai.primary', grantedScopes: ['responses'], permissions: ['responses:create'], capabilities: ['ai.responses'], provenance: { source: 'deployment-config' } });
    if (credentialIds.has('sg.telegram.bot')) items.push({ connectionId: 'telegram', provider: 'telegram', serviceType: 'messaging-platform', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope, externalAccountId: String(env.TELEGRAM_BOT_ID ?? env.TELEGRAM_BOT_USERNAME ?? 'primary'), externalAccount: { botId: env.TELEGRAM_BOT_ID ?? null, botUsername: env.TELEGRAM_BOT_USERNAME ?? null }, credentialId: 'sg.telegram.bot', grantedScopes: ['bot-api'], permissions: ['messages:send','webhook:manage'], capabilities: ['telegram.bot-api','notification.delivery','transport.telegram'], provenance: { source: 'deployment-config' } });
    return items;
  }

  const resource = Object.freeze({
    async start() {
      for (const descriptor of descriptors()) {
        try {
          await registry.connect({ ...descriptor, actor, purpose: 'deployment-connection-bootstrap' });
        } catch (error) {
          if (!(error instanceof ExternalConnectionError) || error.code !== 'connection-already-exists') throw error;

          const existing = await registry.describe({ connectionId: descriptor.connectionId, actor, projectScope: config.projectScope });
          const deploymentManaged = existing.provenance?.source === 'deployment-config';
          if (existing.status === 'revoked') continue;
          if (!deploymentManaged) continue;
          if (!['unavailable', 'degraded'].includes(existing.status)) continue;

          await registry.reconnect({
            connectionId: descriptor.connectionId,
            actor,
            projectScope: config.projectScope,
            credentialId: descriptor.credentialId,
            externalAccount: descriptor.externalAccount,
            grantedScopes: descriptor.grantedScopes,
            permissions: descriptor.permissions,
            capabilities: descriptor.capabilities,
            purpose: 'deployment-connection-recovery'
          });
        }
      }
    }
  });
  return Object.freeze({ registry, store, accessContext, resource, connectionIds: Object.freeze(descriptors().map((item) => item.connectionId)) });
}
