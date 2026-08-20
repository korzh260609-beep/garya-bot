import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createGitHubAppConnectionProvider } from '../src/githubDevelopment/githubAppConnectionProvider.js';
import { ExternalConnectionError } from '../src/connections/externalConnectionsRegistry.js';

const PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const repository = { owner: 'korzh260609-beep', name: 'garya-bot' };

function fixture(overrides = {}) {
  const calls = { registry: 0, credentials: 0, fetch: 0 };
  const connection = { connectionId: 'github:installation:7', provider: 'github', serviceType: 'github-app', credentialId: 'github-app-key', externalAccount: { installationId: '7' }, metadata: { appId: '42' } };
  const connectionRegistry = overrides.connectionRegistry ?? { async requireUsable() { calls.registry += 1; return connection; } };
  const credentialManager = { async useCredential(input) { calls.credentials += 1; return input.operation(PRIVATE_KEY); } };
  const fetchImpl = overrides.fetchImpl ?? (async () => { calls.fetch += 1; return { ok: true, async json() { return { token: 'installation-secret', expires_at: '2026-08-20T12:00:00Z', repository_selection: 'selected', repositories: [{ full_name: 'korzh260609-beep/garya-bot' }], permissions: { contents: 'write', actions: 'read' } }; } }; });
  const provider = createGitHubAppConnectionProvider({ connectionRegistry, credentialManager, connectionAccessContext: { actor: { globalUserId: 'user-1' }, projectScope: 'sg2.1' }, credentialAccessContext: { actor: { globalUserId: 'user-1' }, scope: { projectScope: 'sg2.1' } }, fetchImpl, clock: () => new Date('2026-08-20T10:00:00Z') });
  return { provider, calls };
}

test('checks connection before credential use and returns secret only to authorized callback', async () => {
  const { provider, calls } = fixture();
  const result = await provider.withInstallationToken({ connectionId: 'github:installation:7', capability: 'github.contents.write', repository, requiredProviderPermission: 'contents', operation: async (token, authority) => ({ tokenSeen: token === 'installation-secret', authority }) });
  assert.equal(result.tokenSeen, true);
  assert.equal(result.authority.repository, 'korzh260609-beep/garya-bot');
  assert.equal(JSON.stringify(result.authority).includes('installation-secret'), false);
  assert.deepEqual(calls, { registry: 1, credentials: 1, fetch: 1 });
});

test('caches short-lived installation token and explicit invalidation forces rotation', async () => {
  const { provider, calls } = fixture();
  const input = { connectionId: 'github:installation:7', capability: 'github.repository.read', repository, operation: async () => 'ok' };
  await provider.withInstallationToken(input); await provider.withInstallationToken(input);
  assert.equal(calls.fetch, 1);
  provider.invalidate('github:installation:7'); await provider.withInstallationToken(input);
  assert.equal(calls.fetch, 2);
});

test('revoked or unavailable connection fails before credential and network access', async () => {
  const error = new ExternalConnectionError('revoked', { code: 'connection-revoked' });
  const { provider, calls } = fixture({ connectionRegistry: { async requireUsable() { throw error; } } });
  await assert.rejects(() => provider.withInstallationToken({ connectionId: 'github:installation:7', capability: 'github.repository.read', repository, operation: async () => null }), (caught) => caught.code === 'connection-revoked');
  assert.equal(calls.credentials, 0); assert.equal(calls.fetch, 0);
});

test('selected repository and provider permission are both enforced', async () => {
  const { provider } = fixture();
  await assert.rejects(() => provider.withInstallationToken({ connectionId: 'github:installation:7', capability: 'github.contents.write', repository: { owner: 'other', name: 'repo' }, operation: async () => null }), (error) => error.code === 'gh3-repository-not-selected');
  await assert.rejects(() => provider.withInstallationToken({ connectionId: 'github:installation:7', capability: 'github.repository.admin', repository, requiredProviderPermission: 'administration', operation: async () => null }), (error) => error.code === 'gh3-provider-permission-unavailable');
});

test('provider mismatch fails closed before secret access', async () => {
  const { provider, calls } = fixture({ connectionRegistry: { async requireUsable() { return { connectionId: 'x', provider: 'github', serviceType: 'token', externalAccount: { installationId: 7 }, metadata: { appId: 42 }, credentialId: 'x' }; } } });
  await assert.rejects(() => provider.withInstallationToken({ connectionId: 'x', capability: 'github.repository.read', repository, operation: async () => null }), (error) => error.code === 'connection-provider-mismatch');
  assert.equal(calls.credentials, 0);
});

test('connection verification records healthy state without exposing token', async () => {
  const recorded = [];
  const { provider } = fixture({ connectionRegistry: {
    async requireUsable() { return { connectionId: 'github:installation:7', provider: 'github', serviceType: 'github-app', credentialId: 'github-app-key', externalAccount: { installationId: '7' }, metadata: { appId: '42' } }; },
    async recordVerification(input) { recorded.push(input); }
  } });
  const authority = await provider.verifyConnection({ connectionId: 'github:installation:7' });
  assert.equal(recorded[0].healthy, true);
  assert.equal(JSON.stringify(authority).includes('installation-secret'), false);
});
