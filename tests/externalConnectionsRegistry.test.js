import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalConnectionsRegistry, createInMemoryExternalConnectionStore, ExternalConnectionError } from '../src/connections/externalConnectionsRegistry.js';
import { createDeploymentExternalConnections } from '../src/connections/deploymentConnections.js';
import { createOpenAIResponsesProvider } from '../src/ai/providers/openaiResponsesProvider.js';
import { createTelegramBotApiClient } from '../src/telegram/telegramBotApiClient.js';

function actor(id = 'user:1', grants = ['connection:manage','connection:read','connection:verify']) { return { globalUserId: id, grants }; }

function fixture() {
  const events = [];
  const credentials = new Set(['cred:one','cred:two']);
  const credentialManager = { describeCredential(id) { if (!credentials.has(id)) throw Object.assign(new Error('missing'), { code: 'credential-not-found' }); return { credentialId: id }; } };
  const registry = createExternalConnectionsRegistry({ store: createInMemoryExternalConnectionStore(), audit: (event) => events.push(event), credentialManager });
  return { registry, events };
}

test('Block 16.9 stores explicit authority metadata without raw credentials and distinguishes provider accounts', async () => {
  const { registry } = fixture();
  const a = actor();
  const common = { provider: 'example', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', credentialId: 'cred:one', grantedScopes: ['read'], permissions: ['items:read'], capabilities: ['items.read'], actor: a };
  const first = await registry.connect({ connectionId: 'example:one', externalAccountId: 'acct-1', externalAccount: { displayName: 'Account One' }, ...common });
  const second = await registry.connect({ connectionId: 'example:two', externalAccountId: 'acct-2', externalAccount: { displayName: 'Account Two' }, ...common, credentialId: 'cred:two' });
  assert.equal(first.credentialId, 'cred:one');
  assert.equal(JSON.stringify(first).includes('secret'), false);
  const listed = await registry.list({ actor: a, projectScope: 'project:a', provider: 'example' });
  assert.deepEqual(listed.map((r) => r.connectionId), ['example:one','example:two']);
  assert.deepEqual(listed.map((r) => r.externalAccountId), ['acct-1','acct-2']);
  assert.equal(second.externalAccount.displayName, 'Account Two');
});

test('Block 16.9 isolates owner/project scope and requires explicit connection permissions', async () => {
  const { registry } = fixture();
  await registry.connect({ connectionId: 'c1', provider: 'example', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', externalAccountId: 'a', credentialId: 'cred:one', capabilities: ['items.read'], actor: actor() });
  await assert.rejects(() => registry.describe({ connectionId: 'c1', actor: actor('user:2'), projectScope: 'project:a' }), (e) => e.code === 'connection-owner-mismatch');
  await assert.rejects(() => registry.describe({ connectionId: 'c1', actor: actor('user:1'), projectScope: 'project:b' }), (e) => e.code === 'connection-project-scope-mismatch');
  await assert.rejects(() => registry.describe({ connectionId: 'c1', actor: actor('user:1', []), projectScope: 'project:a' }), (e) => e.code === 'connection-permission-denied');
});

test('Block 16.9 list discovery never exposes another owner in the same project', async () => {
  const { registry } = fixture();
  await registry.connect({ connectionId: 'owner-one', provider: 'example', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', externalAccountId: '1', credentialId: 'cred:one', actor: actor('user:1') });
  await registry.connect({ connectionId: 'owner-two', provider: 'example', serviceType: 'api', ownerGlobalUserId: 'user:2', projectScope: 'project:a', externalAccountId: '2', credentialId: 'cred:two', actor: actor('user:2') });
  const visible = await registry.list({ actor: actor('user:1'), projectScope: 'project:a' });
  assert.deepEqual(visible.map((r) => r.connectionId), ['owner-one']);
});

test('Block 16.9 lifecycle reconnects, verifies, revokes and fails closed for unavailable connections', async () => {
  const { registry, events } = fixture();
  const a = actor();
  await registry.connect({ connectionId: 'c1', provider: 'example', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', externalAccountId: 'acct', credentialId: 'cred:one', capabilities: ['items.read'], actor: a });
  const healthy = await registry.recordVerification({ connectionId: 'c1', actor: a, projectScope: 'project:a', healthy: true });
  assert.equal(healthy.healthState, 'healthy');
  assert.ok(healthy.lastSuccessfulVerificationAt);
  const unavailable = await registry.recordVerification({ connectionId: 'c1', actor: a, projectScope: 'project:a', healthy: false });
  assert.equal(unavailable.status, 'unavailable');
  await assert.rejects(() => registry.requireUsable({ connectionId: 'c1', capability: 'items.read', actor: a, projectScope: 'project:a' }), (e) => e.code === 'connection-unavailable');
  const reconnected = await registry.reconnect({ connectionId: 'c1', actor: a, projectScope: 'project:a', credentialId: 'cred:two' });
  assert.equal(reconnected.status, 'connected');
  assert.equal(reconnected.credentialId, 'cred:two');
  assert.equal((await registry.requireUsable({ connectionId: 'c1', capability: 'items.read', actor: a, projectScope: 'project:a' })).connectionId, 'c1');
  const revoked = await registry.revoke({ connectionId: 'c1', actor: a, projectScope: 'project:a' });
  assert.equal(revoked.status, 'revoked');
  await assert.rejects(() => registry.requireUsable({ connectionId: 'c1', actor: a, projectScope: 'project:a' }), (e) => e.code === 'connection-revoked');
  assert.ok(events.some((e) => e.data.operation === 'connect'));
  assert.ok(events.some((e) => e.data.operation === 'revoke'));
  assert.equal(JSON.stringify(events).includes('cred:one'), false);
});

test('Block 16.9 deployment bootstrap preserves revoked state instead of silently reconnecting', async () => {
  const credentialManager = {
    listCredentials() { return [{ credentialId: 'sg.openai.primary' }]; },
    describeCredential(id) { return { credentialId: id }; }
  };
  const deployment = createDeploymentExternalConnections({
    credentialManager,
    observability: { record() {} },
    config: { environment: 'test', revision: 'block-16.9', projectScope: 'sg2.1' }
  });
  await deployment.resource.start();
  await deployment.registry.revoke({ connectionId: 'openai', actor: deployment.accessContext.actor, projectScope: 'sg2.1' });
  await deployment.resource.start();
  const restored = await deployment.registry.describe({ connectionId: 'openai', actor: deployment.accessContext.actor, projectScope: 'sg2.1' });
  assert.equal(restored.status, 'revoked');
});

test('deployment bootstrap never creates a parallel GitHub Development connection from GitHub App env', async () => {
  const credentials = [];
  const credentialManager = {
    listCredentials() { return credentials; },
    registerCredential(record) { credentials.push(record); return record; },
    describeCredential(id) { return credentials.find((record) => record.credentialId === id); }
  };
  const deployment = createDeploymentExternalConnections({
    credentialManager,
    observability: { record() {} },
    config: { environment: 'test', revision: 'direct-github-app', projectScope: 'sg2.1' },
    env: {
      GITHUB_APP_ID: '42',
      GITHUB_APP_INSTALLATION_ID: '7',
      GITHUB_APP_PRIVATE_KEY: 'secret-private-key',
      GITHUB_APP_PRIVATE_KEY_BASE64: 'encoded-private-key'
    }
  });
  await deployment.resource.start();
  assert.equal(credentials.some((item) => item.credentialId === 'sg.github.app.private-key'), false);
  assert.equal(deployment.connectionIds.includes('github-development'), false);
  await assert.rejects(
    () => deployment.registry.describe({ connectionId: 'github-development', actor: deployment.accessContext.actor, projectScope: 'sg2.1' }),
    (error) => error?.code === 'connection-not-found'
  );
});

test('Block 16.9 discovery resolves only connected capability providers', async () => {
  const { registry } = fixture();
  const a = actor();
  await registry.connect({ connectionId: 'one', provider: 'p', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', externalAccountId: '1', credentialId: 'cred:one', capabilities: ['cap.a'], actor: a });
  await registry.connect({ connectionId: 'two', provider: 'p', serviceType: 'api', ownerGlobalUserId: 'user:1', projectScope: 'project:a', externalAccountId: '2', credentialId: 'cred:two', capabilities: ['cap.a','cap.b'], actor: a });
  await registry.recordVerification({ connectionId: 'two', actor: a, projectScope: 'project:a', healthy: false });
  assert.deepEqual((await registry.resolveCapability({ capability: 'cap.a', actor: a, projectScope: 'project:a' })).map((r) => r.connectionId), ['one']);
});

test('OpenAI and Telegram provider paths refuse execution before credential/network use when connection is revoked', async () => {
  const registry = { async requireUsable() { throw new ExternalConnectionError('revoked', { code: 'connection-revoked' }); } };
  const connectionAccessContext = { actor: actor('system:runtime', ['connection:read']), projectScope: 'sg2.1' };
  let credentialUses = 0;
  const credentialManager = { async useCredential() { credentialUses += 1; throw new Error('must not use credential'); } };
  const credentialAccessContext = { actor: { globalUserId: 'system:runtime', grants: ['credential:use:system'] }, scope: { projectScope: 'sg2.1' } };
  const openai = createOpenAIResponsesProvider({ credentialManager, credentialAccessContext, connectionRegistry: registry, connectionAccessContext, fetchImpl: async () => { throw new Error('network'); } });
  await assert.rejects(() => openai.generate({ request: { messages: [] }, model: { model: 'gpt-test' } }), (e) => e.code === 'connection-revoked');
  const telegram = createTelegramBotApiClient({ credentialManager, credentialAccessContext, connectionRegistry: registry, connectionAccessContext, maxRetries: 0, fetchImpl: async () => { throw new Error('network'); } });
  await assert.rejects(() => telegram.sendMessage({ chatId: '1', text: 'hi' }), (e) => e.code === 'connection-revoked');
  assert.equal(credentialUses, 0);
});
