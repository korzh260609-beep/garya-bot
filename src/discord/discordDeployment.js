import { ExternalConnectionError } from '../connections/externalConnectionsRegistry.js';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

export function registerDiscordDeploymentCredential({ credentialManager, env = process.env, projectScope = 'sg2.1' } = {}) {
  if (!credentialManager || typeof credentialManager.registerCredential !== 'function' || typeof credentialManager.listCredentials !== 'function') {
    throw new TypeError('credentialManager is required');
  }
  const token = typeof env.DISCORD_BOT_TOKEN === 'string' ? env.DISCORD_BOT_TOKEN : '';
  if (token === '') return null;
  const existing = credentialManager.listCredentials().find((item) => item.credentialId === 'sg.discord.bot');
  if (existing) return existing;
  return credentialManager.registerCredential({
    credentialId: 'sg.discord.bot',
    type: 'bot-token',
    secretRef: { provider: 'environment', key: 'DISCORD_BOT_TOKEN' },
    ownerUserId: 'system:runtime',
    projectScope: requiredString(projectScope, 'projectScope'),
    connectionId: 'discord',
    requiredPermission: 'credential:use:system',
    metadata: { provider: 'discord', source: 'deployment-config' }
  });
}

export async function bootstrapDiscordExternalConnection({
  connectionRegistry,
  connectionAccessContext,
  credentialManager,
  config,
  applicationId,
  botUserId
} = {}) {
  if (!connectionRegistry || typeof connectionRegistry.connect !== 'function') throw new TypeError('connectionRegistry is required');
  if (!connectionAccessContext?.actor || !connectionAccessContext?.projectScope) throw new TypeError('connectionAccessContext is required');
  if (!credentialManager?.listCredentials) throw new TypeError('credentialManager is required');
  if (!credentialManager.listCredentials().some((item) => item.credentialId === 'sg.discord.bot')) throw new Error('Discord bot credential is not registered');
  const projectScope = config?.projectScope ?? connectionAccessContext.projectScope;
  const descriptor = {
    connectionId: 'discord',
    provider: 'discord',
    serviceType: 'messaging-platform',
    ownerGlobalUserId: 'system:runtime',
    projectScope,
    externalAccountId: requiredString(applicationId, 'Discord applicationId'),
    externalAccount: { applicationId: requiredString(applicationId, 'Discord applicationId'), botUserId: requiredString(botUserId, 'Discord botUserId') },
    credentialId: 'sg.discord.bot',
    grantedScopes: ['gateway', 'bot-api'],
    permissions: ['messages:read', 'messages:send'],
    capabilities: ['discord.bot-api', 'discord.gateway', 'notification.delivery', 'transport.discord'],
    provenance: { source: 'deployment-config' }
  };
  try {
    return await connectionRegistry.connect({ ...descriptor, actor: connectionAccessContext.actor, purpose: 'discord-deployment-bootstrap' });
  } catch (error) {
    if (!(error instanceof ExternalConnectionError) || error.code !== 'connection-already-exists') throw error;
    const existing = await connectionRegistry.describe({ connectionId: 'discord', actor: connectionAccessContext.actor, projectScope });
    if (existing.status === 'revoked') throw new ExternalConnectionError('Discord connection is revoked', { code: 'connection-revoked' });
    if (existing.provenance?.source !== 'deployment-config') return existing;
    if (!['unavailable', 'degraded'].includes(existing.status)) return existing;
    return connectionRegistry.reconnect({
      connectionId: 'discord',
      actor: connectionAccessContext.actor,
      projectScope,
      credentialId: 'sg.discord.bot',
      externalAccount: descriptor.externalAccount,
      grantedScopes: descriptor.grantedScopes,
      permissions: descriptor.permissions,
      capabilities: descriptor.capabilities,
      purpose: 'discord-deployment-recovery'
    });
  }
}
