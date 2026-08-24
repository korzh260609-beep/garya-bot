import test from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialManager, createEnvironmentSecretStore } from '../src/secrets/credentialManager.js';
import { createExternalConnectionsRegistry, createInMemoryExternalConnectionStore } from '../src/connections/externalConnectionsRegistry.js';
import { registerDiscordDeploymentCredential, bootstrapDiscordExternalConnection } from '../src/discord/discordDeployment.js';

const APPLICATION_ID = '1536265430883242034';

test('Discord deployment registers token by secret reference and bootstraps External Connection without exposing raw token', async () => {
  const env = { DISCORD_BOT_TOKEN: 'do-not-expose' };
  const credentialManager = createCredentialManager({ secretStore: createEnvironmentSecretStore({ env }) });
  const credential = registerDiscordDeploymentCredential({ credentialManager, env, projectScope: 'sg2.1' });
  assert.equal(credential.credentialId, 'sg.discord.bot');
  assert.equal(credential.storeProvider, 'environment');
  assert.equal(JSON.stringify(credential).includes('do-not-expose'), false);

  const connectionRegistry = createExternalConnectionsRegistry({ store: createInMemoryExternalConnectionStore(), credentialManager });
  const actor = { globalUserId: 'system:runtime', grants: ['connection:manage', 'connection:read', 'connection:verify', 'connection:manage:any'] };
  const access = { actor, projectScope: 'sg2.1' };
  const connection = await bootstrapDiscordExternalConnection({
    connectionRegistry,
    connectionAccessContext: access,
    credentialManager,
    config: { projectScope: 'sg2.1' },
    applicationId: APPLICATION_ID,
    botUserId: APPLICATION_ID
  });
  assert.equal(connection.connectionId, 'discord');
  assert.equal(connection.status, 'connected');
  assert.ok(connection.capabilities.includes('discord.gateway'));
  assert.ok(connection.capabilities.includes('discord.bot-api'));
  assert.equal(JSON.stringify(connection).includes('do-not-expose'), false);
});
