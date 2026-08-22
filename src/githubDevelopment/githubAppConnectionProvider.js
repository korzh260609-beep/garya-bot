import { createSign } from 'node:crypto';
import { ExternalConnectionError } from '../connections/externalConnectionsRegistry.js';
import { createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError(`${field} must be a positive integer`);
  return number;
}

function base64url(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function normalizedPrivateKey(value) { const key = required(value, 'GitHub App private key'); return key.includes('\\n') && !key.includes('\n') ? key.replace(/\\n/gu, '\n') : key; }

function createAppJwt({ appId, privateKey, now }) {
  const issuedAt = Math.floor(now.getTime() / 1000) - 30;
  const header = base64url({ alg: 'RS256', typ: 'JWT' });
  const payload = base64url({ iat: issuedAt, exp: issuedAt + 570, iss: String(appId) });
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(normalizedPrivateKey(privateKey)).toString('base64url')}`;
}

function safeAuthority({ connection, body, repository }) {
  const repositories = Array.isArray(body.repositories)
    ? body.repositories.map((item) => item?.full_name).filter((item) => typeof item === 'string')
    : [];
  return Object.freeze({
    connectionId: connection.connectionId,
    installationId: String(connection.externalAccount.installationId),
    repositorySelection: body.repository_selection ?? connection.metadata?.repositorySelection ?? 'selected',
    repositories: Object.freeze(repositories.sort()),
    permissions: Object.freeze({ ...(body.permissions ?? {}) }),
    repository: repository?.fullName ?? null,
    expiresAt: required(body.expires_at, 'installation token expires_at')
  });
}

export class GitHubAppConnectionError extends Error {
  constructor(message, { code = 'gh3-github-app-connection-error', retryable = false } = {}) {
    super(message); this.name = 'GitHubAppConnectionError'; this.code = code; this.retryable = retryable;
  }
}

export function createGitHubAppConnectionProvider({
  connectionRegistry,
  credentialManager,
  connectionAccessContext,
  credentialAccessContext,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = 'https://api.github.com',
  clock = () => new Date()
} = {}) {
  if (!connectionRegistry?.requireUsable) throw new TypeError('connectionRegistry.requireUsable is required');
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!connectionAccessContext?.actor || !connectionAccessContext?.projectScope) throw new TypeError('connectionAccessContext is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new TypeError('invalid GitHub App provider dependency');
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');
  const tokenCache = new Map();

  async function connection(connectionId, capability) {
    const record = await connectionRegistry.requireUsable({
      connectionId, capability, actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope
    });
    if (record.provider !== 'github' || record.serviceType !== 'github-app') {
      throw new ExternalConnectionError('connection is not a GitHub App installation', { code: 'connection-provider-mismatch' });
    }
    positiveInteger(record.externalAccount?.installationId, 'connection.externalAccount.installationId');
    positiveInteger(record.metadata?.appId, 'connection.metadata.appId');
    required(record.credentialId, 'connection.credentialId');
    return record;
  }

  function cached(connectionId) {
    const item = tokenCache.get(connectionId);
    if (!item) return null;
    if (new Date(item.authority.expiresAt).getTime() - clock().getTime() <= 60_000) {
      tokenCache.delete(connectionId);
      return null;
    }
    return item;
  }

  async function mint(record) {
    const existing = cached(record.connectionId);
    if (existing) return existing;
    return credentialManager.useCredential({
      credentialId: record.credentialId,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      purpose: 'gh3.github-app.installation-token',
      connectionId: record.connectionId,
      operation: async (privateKey) => {
        const jwt = createAppJwt({ appId: record.metadata.appId, privateKey, now: clock() });
        let response;
        try {
          response = await fetchImpl(`${base}/app/installations/${record.externalAccount.installationId}/access_tokens`, {
            method: 'POST',
            headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jwt}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sg-gh3' }
          });
        } catch {
          throw new GitHubAppConnectionError('GitHub installation token request failed', { code: 'gh3-github-app-unavailable', retryable: true });
        }
        if (!response?.ok) throw new GitHubAppConnectionError('GitHub installation token request was denied', { code: `gh3-github-app-http-${response?.status ?? 'unknown'}`, retryable: response?.status >= 500 });
        const body = await response.json();
        const token = required(body.token, 'installation token');
        const authority = safeAuthority({ connection: record, body });
        const item = Object.freeze({ token, authority });
        tokenCache.set(record.connectionId, item);
        return item;
      }
    });
  }

  async function withInstallationToken({ connectionId, capability, repository = null, requiredProviderPermission = null, operation } = {}) {
    if (typeof operation !== 'function') throw new TypeError('operation callback is required');
    const record = await connection(required(connectionId, 'connectionId'), required(capability, 'capability'));
    const selectedRepository = repository ? createGitHubRepositoryIdentity(repository) : null;
    const item = await mint(record);
    const authority = Object.freeze({ ...item.authority, repository: selectedRepository?.fullName ?? null });
    if (selectedRepository && item.authority.repositorySelection === 'selected' && !item.authority.repositories.includes(selectedRepository.fullName)) {
      throw new GitHubAppConnectionError('repository is outside the GitHub App installation selection', { code: 'gh3-repository-not-selected' });
    }
    if (requiredProviderPermission && !['read', 'write', 'admin'].includes(item.authority.permissions?.[requiredProviderPermission])) {
      throw new GitHubAppConnectionError('GitHub App provider permission is unavailable', { code: 'gh3-provider-permission-unavailable' });
    }
    return operation(item.token, authority);
  }

  async function verifyConnection({ connectionId, capability = 'github.repository.read' } = {}) {
    const id = required(connectionId, 'connectionId');
    try {
      const record = await connection(id, capability);
      const item = await mint(record);
      if (typeof connectionRegistry.recordVerification === 'function') {
        await connectionRegistry.recordVerification({ connectionId: id, actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope, healthy: true, purpose: 'gh3.github-app.verify' });
      }
      return item.authority;
    } catch (error) {
      if (typeof connectionRegistry.recordVerification === 'function' && error?.code !== 'connection-revoked' && error?.code !== 'connection-permission-denied') {
        try {
          await connectionRegistry.recordVerification({ connectionId: id, actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope, healthy: false, reason: error?.code ?? 'gh3-github-app-verification-failed', purpose: 'gh3.github-app.verify' });
        } catch {}
      }
      throw error;
    }
  }

  function invalidate(connectionId) { tokenCache.delete(required(connectionId, 'connectionId')); }
  return Object.freeze({ withInstallationToken, verifyConnection, invalidate });
}
