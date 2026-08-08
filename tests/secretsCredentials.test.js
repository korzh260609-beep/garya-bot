import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CredentialAccessError,
  createCredentialManager,
  createDeploymentCredentialManager,
  createInMemorySecretStore,
  createSecretStoreRouter,
} from '../src/secrets/credentialManager.js';
import { redactSensitiveData, redactSensitiveText } from '../src/secrets/redaction.js';
import { createOpenAIResponsesProvider } from '../src/ai/providers/openaiResponsesProvider.js';
import { createTelegramBotApiClient } from '../src/telegram/telegramBotApiClient.js';
import { loadTelegramConfig } from '../src/telegram/telegramConfig.js';

function actor(globalUserId, grants = ['credential:use', 'credential:manage']) {
  return Object.freeze({ globalUserId, grants, roles: [] });
}
function scope(projectScope = 'sg2.1') { return Object.freeze({ projectScope }); }

function fixtureManager({ now = '2026-08-08T12:00:00.000Z', audit = () => {} } = {}) {
  const store = createInMemorySecretStore({ primary: 'TOP-SECRET-123', rotated: 'ROTATED-SECRET-456' });
  const secretStore = createSecretStoreRouter({ stores: [store] });
  const clockState = { value: new Date(now) };
  const manager = createCredentialManager({ secretStore, audit, clock: () => new Date(clockState.value) });
  return { manager, store, clockState };
}

test('credentials expose stable handles and metadata but never raw secret references or values', async () => {
  const events = [];
  const { manager } = fixtureManager({ audit: (event) => events.push(event) });
  const described = manager.registerCredential({
    credentialId: 'user.api.primary',
    type: 'api-key',
    secretRef: { provider: 'memory', key: 'primary' },
    ownerUserId: 'u1', projectScope: 'sg2.1', connectionId: 'service-a', resourceId: 'resource-1',
  });

  assert.equal(described.credentialId, 'user.api.primary');
  assert.equal(described.storeProvider, 'memory');
  assert.equal('secretRef' in described, false);
  assert.equal(JSON.stringify(described).includes('TOP-SECRET-123'), false);
  assert.equal(JSON.stringify(described).includes('primary'), true);

  const result = await manager.useCredential({
    credentialId: 'user.api.primary', actor: actor('u1'), scope: scope(), purpose: 'test-provider-call',
    connectionId: 'service-a', resourceId: 'resource-1',
    operation: async (secret, metadata) => ({ authorized: secret === 'TOP-SECRET-123', credentialId: metadata.credentialId })
  });
  assert.deepEqual(result, { authorized: true, credentialId: 'user.api.primary' });
  const serializedAudit = JSON.stringify(events);
  assert.equal(serializedAudit.includes('TOP-SECRET-123'), false);
  assert.ok(events.some((event) => event.actorRef === 'u1' && event.data.connectionId === 'service-a' && event.data.resourceId === 'resource-1' && event.data.purpose === 'test-provider-call'));
});

test('credential access fails closed across users, projects, connections, resources and permissions', async () => {
  let reads = 0;
  const secretStore = {
    async read() { reads += 1; return 'NEVER-LEAK'; }
  };
  const manager = createCredentialManager({ secretStore });
  manager.registerCredential({
    credentialId: 'isolated', type: 'api-key', secretRef: { provider: 'fixture', key: 'x' },
    ownerUserId: 'owner', projectScope: 'project-a', connectionId: 'connection-a', resourceId: 'resource-a'
  });

  const attempts = [
    { actor: actor('other'), scope: scope('project-a'), connectionId: 'connection-a', resourceId: 'resource-a', code: 'credential-user-scope-mismatch' },
    { actor: actor('owner'), scope: scope('project-b'), connectionId: 'connection-a', resourceId: 'resource-a', code: 'credential-project-scope-mismatch' },
    { actor: actor('owner'), scope: scope('project-a'), connectionId: 'connection-b', resourceId: 'resource-a', code: 'credential-scope-mismatch' },
    { actor: actor('owner'), scope: scope('project-a'), connectionId: 'connection-a', resourceId: 'resource-b', code: 'credential-scope-mismatch' },
    { actor: actor('owner', []), scope: scope('project-a'), connectionId: 'connection-a', resourceId: 'resource-a', code: 'credential-permission-denied' },
  ];

  for (const attempt of attempts) {
    await assert.rejects(
      () => manager.useCredential({ credentialId: 'isolated', ...attempt, purpose: 'isolation-test', operation: () => true }),
      (error) => error instanceof CredentialAccessError && error.code === attempt.code
    );
  }
  assert.equal(reads, 0, 'unauthorized access must be rejected before secret-store read');
});

test('revoked and expired credentials fail visibly and rotation switches the secret reference', async () => {
  const { manager, clockState } = fixtureManager();
  manager.registerCredential({ credentialId: 'rotating', type: 'api-key', secretRef: { provider: 'memory', key: 'primary' }, ownerUserId: 'u1', projectScope: 'sg2.1' });
  const before = await manager.useCredential({ credentialId: 'rotating', actor: actor('u1'), scope: scope(), purpose: 'before-rotation', operation: (secret) => secret });
  assert.equal(before, 'TOP-SECRET-123');
  const rotated = manager.rotateCredential({ credentialId: 'rotating', secretRef: { provider: 'memory', key: 'rotated' }, actor: actor('u1'), scope: scope() });
  assert.equal(rotated.version, 2);
  const after = await manager.useCredential({ credentialId: 'rotating', actor: actor('u1'), scope: scope(), purpose: 'after-rotation', operation: (secret) => secret });
  assert.equal(after, 'ROTATED-SECRET-456');
  manager.revokeCredential({ credentialId: 'rotating', actor: actor('u1'), scope: scope() });
  await assert.rejects(() => manager.useCredential({ credentialId: 'rotating', actor: actor('u1'), scope: scope(), purpose: 'revoked', operation: () => true }), (error) => error.code === 'credential-revoked');

  manager.registerCredential({ credentialId: 'expiring', type: 'oauth', secretRef: { provider: 'memory', key: 'primary' }, ownerUserId: 'u1', projectScope: 'sg2.1', expiresAt: '2026-08-08T12:01:00.000Z' });
  clockState.value = new Date('2026-08-08T12:02:00.000Z');
  assert.equal(manager.describeCredential('expiring').state, 'expired');
  await assert.rejects(() => manager.useCredential({ credentialId: 'expiring', actor: actor('u1'), scope: scope(), purpose: 'expired', operation: () => true }), (error) => error.code === 'credential-expired');
});

test('deployment secret store registers stable production handles without exposing environment values', () => {
  const env = { OPENAI_API_KEY: 'sk-production-secret', TELEGRAM_BOT_TOKEN: '123456:telegram-secret' };
  const deployment = createDeploymentCredentialManager({ env, projectScope: 'sg2.1' });
  const snapshot = deployment.manager.listCredentials();
  assert.deepEqual(snapshot.map((item) => item.credentialId).sort(), ['sg.openai.primary', 'sg.telegram.bot', 'sg.telegram.webhook']);
  const serialized = JSON.stringify({ snapshot, providers: deployment.providers, access: deployment.accessContext });
  assert.equal(serialized.includes(env.OPENAI_API_KEY), false);
  assert.equal(serialized.includes(env.TELEGRAM_BOT_TOKEN), false);
  assert.deepEqual(deployment.providers, ['environment', 'derived-sha256']);
});

test('ordinary Telegram configuration contains credential handles rather than raw secret values', () => {
  const env = { TELEGRAM_BOT_TOKEN: '123:raw-token', TELEGRAM_WEBHOOK_SECRET: 'raw-webhook-secret', BASE_URL: 'https://example.test' };
  const config = loadTelegramConfig(env);
  assert.equal(config.botTokenCredentialId, 'sg.telegram.bot');
  assert.equal(config.webhookSecretCredentialId, 'sg.telegram.webhook');
  assert.equal(JSON.stringify(config).includes(env.TELEGRAM_BOT_TOKEN), false);
  assert.equal(JSON.stringify(config).includes(env.TELEGRAM_WEBHOOK_SECRET), false);
  assert.equal('token' in config, false);
  assert.equal('webhookSecret' in config, false);
});

test('OpenAI provider receives the secret only inside the bounded credential callback and sanitizes reflected errors', async () => {
  const secret = 'sk-private-never-log';
  const deployment = createDeploymentCredentialManager({ env: { OPENAI_API_KEY: secret } });
  let authorization = null;
  const provider = createOpenAIResponsesProvider({
    credentialManager: deployment.manager,
    credentialAccessContext: deployment.accessContext,
    fetchImpl: async (_url, options) => {
      authorization = options.headers.authorization;
      return { ok: false, status: 401, async json() { return { error: { message: `invalid ${secret}`, code: 'invalid_api_key' } }; } };
    }
  });
  await assert.rejects(
    () => provider.generate({ request: { messages: [{ role: 'user', content: 'hello' }] }, model: { model: 'gpt-test' } }),
    (error) => error.code === 'AI_PROVIDER_HTTP_401' && !error.message.includes(secret)
  );
  assert.equal(authorization, `Bearer ${secret}`);
});

test('Telegram client uses credential handle and network failures do not reflect token-bearing URLs', async () => {
  const secret = '123456:telegram-private-token';
  const deployment = createDeploymentCredentialManager({ env: { TELEGRAM_BOT_TOKEN: secret } });
  let requestedUrl = '';
  const client = createTelegramBotApiClient({
    credentialManager: deployment.manager,
    credentialAccessContext: deployment.accessContext,
    maxRetries: 0,
    fetchImpl: async (url) => { requestedUrl = url; throw new Error(`failed ${url}`); }
  });
  await assert.rejects(() => client.sendMessage({ chatId: 1, text: 'hello' }), (error) => error.code === 'telegram-network-failure' && !error.message.includes(secret));
  assert.ok(requestedUrl.includes(secret), 'the provider URL itself still requires the Telegram bot token');
});

test('redaction removes common credential forms from strings and structured diagnostics', () => {
  const text = 'Authorization: Bearer abc.def.ghi https://api.telegram.org/bot123456:ABC_def/sendMessage?token=hello';
  const redacted = redactSensitiveText(text);
  assert.equal(redacted.includes('abc.def.ghi'), false);
  assert.equal(redacted.includes('123456:ABC_def'), false);
  assert.equal(redacted.includes('token=hello'), false);
  const data = redactSensitiveData({ apiKey: 'key', nested: { password: 'pw', note: 'Bearer secret-token' } });
  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes('"key"'), false);
  assert.equal(serialized.includes('"pw"'), false);
  assert.equal(serialized.includes('secret-token'), false);
});
