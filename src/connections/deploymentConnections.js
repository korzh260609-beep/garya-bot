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

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

export function createDeploymentExternalConnections({ persistence = null, credentialManager, observability, config, env = {}, clock = () => new Date() } = {}) {
  if (!credentialManager || typeof credentialManager.listCredentials !== 'function') throw new TypeError('credentialManager is required');

  const discordEnabled = enabled(env.SG_DISCORD_ENABLED ?? env.DISCORD_ENABLED);
  const discordTokenAvailable = typeof env.DISCORD_BOT_TOKEN === 'string' && env.DISCORD_BOT_TOKEN !== '';
  const githubAppConfigured = [env.GITHUB_APP_ID, env.GITHUB_APP_INSTALLATION_ID, env.GITHUB_APP_PRIVATE_KEY].every((item) => typeof item === 'string' && item.trim() !== '');
  const existingCredentialIds = new Set(credentialManager.listCredentials().map((item) => item.credentialId));

  if (discordEnabled && discordTokenAvailable && !existingCredentialIds.has('sg.discord.bot')) {
    if (typeof credentialManager.registerCredential !== 'function') {
      throw new TypeError('credentialManager.registerCredential is required for enabled Discord deployment');
    }
    credentialManager.registerCredential({
      credentialId: 'sg.discord.bot',
      type: 'bot-token',
      secretRef: { provider: 'environment', key: 'DISCORD_BOT_TOKEN' },
      ownerUserId: 'system:runtime',
      projectScope: config.projectScope,
      connectionId: 'discord',
      requiredPermission: 'credential:use:system',
      metadata: { provider: 'discord', source: 'deployment-config' }
    });
  }
  if (githubAppConfigured && !existingCredentialIds.has('sg.github.app.private-key')) {
    if (typeof credentialManager.registerCredential !== 'function') throw new TypeError('credentialManager.registerCredential is required for GitHub App deployment');
    credentialManager.registerCredential({
      credentialId: 'sg.github.app.private-key', type: 'private-key', secretRef: { provider: 'environment', key: 'GITHUB_APP_PRIVATE_KEY' },
      ownerUserId: 'system:runtime', projectScope: config.projectScope, connectionId: 'github-development', requiredPermission: 'credential:use:system',
      metadata: { provider: 'github', purpose: 'gh3-github-app', authentication: 'github-app', source: 'deployment-config' }
    });
  }

  const store = persistence ? createPostgresExternalConnectionStore({ database: persistence.database }) : createInMemoryExternalConnectionStore();
  const registry = createExternalConnectionsRegistry({ store, clock, audit: auditAdapter(observability, config), credentialManager });
  const actor = Object.freeze({ globalUserId: 'system:runtime', roles: Object.freeze(['system']), grants: Object.freeze(['connection:manage','connection:read','connection:verify','connection:manage:any']) });
  const accessContext = Object.freeze({ actor, projectScope: config.projectScope });

  function descriptors() {
    const credentialIds = new Set(credentialManager.listCredentials().map((item) => item.credentialId));
    const items = [];
    if (credentialIds.has('sg.openai.primary')) items.push({ connectionId: 'openai', provider: 'openai', serviceType: 'ai-provider', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope, externalAccountId: 'primary', externalAccount: { label: 'OpenAI primary' }, credentialId: 'sg.openai.primary', grantedScopes: ['responses'], permissions: ['responses:create'], capabilities: ['ai.responses'], provenance: { source: 'deployment-config' } });
    if (credentialIds.has('sg.telegram.bot')) items.push({ connectionId: 'telegram', provider: 'telegram', serviceType: 'messaging-platform', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope, externalAccountId: String(env.TELEGRAM_BOT_ID ?? env.TELEGRAM_BOT_USERNAME ?? 'primary'), externalAccount: { botId: env.TELEGRAM_BOT_ID ?? null, botUsername: env.TELEGRAM_BOT_USERNAME ?? null }, credentialId: 'sg.telegram.bot', grantedScopes: ['bot-api'], permissions: ['messages:send','webhook:manage'], capabilities: ['telegram.bot-api','notification.delivery','transport.telegram'], provenance: { source: 'deployment-config' } });
    if (discordEnabled && credentialIds.has('sg.discord.bot')) items.push({ connectionId: 'discord', provider: 'discord', serviceType: 'messaging-platform', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope, externalAccountId: String(env.DISCORD_APPLICATION_ID ?? env.DISCORD_BOT_USER_ID ?? 'primary'), externalAccount: { applicationId: env.DISCORD_APPLICATION_ID ?? null, botUserId: env.DISCORD_BOT_USER_ID ?? env.DISCORD_APPLICATION_ID ?? null }, credentialId: 'sg.discord.bot', grantedScopes: ['bot-api','gateway'], permissions: ['messages:read','messages:send'], capabilities: ['discord.bot-api','discord.gateway','notification.delivery','transport.discord'], provenance: { source: 'deployment-config' } });
    if (githubAppConfigured && credentialIds.has('sg.github.app.private-key')) items.push({
      connectionId: 'github-development', provider: 'github', serviceType: 'github-app', ownerGlobalUserId: 'system:runtime', projectScope: config.projectScope,
      externalAccountId: String(env.GITHUB_APP_INSTALLATION_ID), externalAccount: { installationId: String(env.GITHUB_APP_INSTALLATION_ID) }, credentialId: 'sg.github.app.private-key',
      grantedScopes: ['installation'], permissions: ['repository:selected'],
      capabilities: ['github.repository.read','github.code.search','github.branch.create','github.contents.write','github.commit.create','github.pull-request.read','github.pull-request.write','github.review.read','github.review.write','github.issue.read','github.issue.write','github.actions.read','github.actions.dispatch','github.actions.rerun','github.release.write'],
      metadata: { appId: String(env.GITHUB_APP_ID), repositorySelection: 'selected' }, provenance: { source: 'deployment-config' }
    });
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
          const descriptorChanged = existing.credentialId !== descriptor.credentialId
            || JSON.stringify(existing.externalAccount ?? {}) !== JSON.stringify(descriptor.externalAccount ?? {})
            || JSON.stringify(existing.grantedScopes ?? []) !== JSON.stringify(descriptor.grantedScopes ?? [])
            || JSON.stringify(existing.permissions ?? []) !== JSON.stringify(descriptor.permissions ?? [])
            || JSON.stringify(existing.capabilities ?? []) !== JSON.stringify(descriptor.capabilities ?? [])
            || JSON.stringify(existing.metadata ?? {}) !== JSON.stringify(descriptor.metadata ?? {});
          if (!descriptorChanged && !['unavailable', 'degraded'].includes(existing.status)) continue;

          await registry.reconnect({
            connectionId: descriptor.connectionId,
            actor,
            projectScope: config.projectScope,
            credentialId: descriptor.credentialId,
            externalAccount: descriptor.externalAccount,
            grantedScopes: descriptor.grantedScopes,
            permissions: descriptor.permissions,
            capabilities: descriptor.capabilities,
            metadata: descriptor.metadata,
            purpose: descriptorChanged ? 'deployment-connection-refresh' : 'deployment-connection-recovery'
          });
        }
      }
    }
  });
  return Object.freeze({ registry, store, accessContext, resource, connectionIds: Object.freeze(descriptors().map((item) => item.connectionId)) });
}
