import test from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialManager, createEnvironmentSecretStore } from '../src/secrets/credentialManager.js';
import { createDeploymentExternalConnections } from '../src/connections/deploymentConnections.js';

const APPLICATION_ID = '1536265430883242034';

test('enabled Discord deployment is represented in canonical External Connections Registry', async () => {
  const env = {
    SG_DISCORD_ENABLED: 'true',
    DISCORD_BOT_TOKEN: 'secret-discord-token',
    DISCORD_APPLICATION_ID: APPLICATION_ID
  };
  const credentialManager = createCredentialManager({ secretStore: createEnvironmentSecretStore({ env }) });
  const deployment = createDeploymentExternalConnections({
    credentialManager,
    observability: { record() {} },
    config: { environment: 'test', revision: 'block-8.1', projectScope: 'sg2.1' },
    env
  });
  assert.ok(deployment.connectionIds.includes('discord'));
  assert.ok(credentialManager.listCredentials().some((item) => item.credentialId === 'sg.discord.bot'));
  await deployment.resource.start();
  const connection = await deployment.registry.describe({ connectionId: 'discord', actor: deployment.accessContext.actor, projectScope: 'sg2.1' });
  assert.equal(connection.provider, 'discord');
  assert.equal(connection.externalAccount.applicationId, APPLICATION_ID);
  assert.ok(connection.capabilities.includes('discord.gateway'));
  assert.ok(connection.capabilities.includes('notification.delivery'));
  assert.equal(JSON.stringify(connection).includes('secret-discord-token'), false);
});

test('Discord token alone does not activate transport without explicit enablement', () => {
  const env = { DISCORD_BOT_TOKEN: 'stored-but-disabled', DISCORD_APPLICATION_ID: APPLICATION_ID, SG_DISCORD_ENABLED: 'false' };
  const credentialManager = createCredentialManager({ secretStore: createEnvironmentSecretStore({ env }) });
  const deployment = createDeploymentExternalConnections({
    credentialManager,
    observability: { record() {} },
    config: { environment: 'test', revision: 'block-8.1', projectScope: 'sg2.1' },
    env
  });
  assert.equal(deployment.connectionIds.includes('discord'), false);
  assert.equal(credentialManager.listCredentials().some((item) => item.credentialId === 'sg.discord.bot'), false);
});
