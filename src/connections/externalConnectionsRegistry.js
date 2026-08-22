const STATUSES = new Set(['connected','degraded','unavailable','revoked']);
const HEALTH = new Set(['unknown','healthy','degraded','unavailable','revoked']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function uniqueStrings(values = [], name) {
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
  return Object.freeze([...new Set(values.map((v) => required(v, `${name} item`)))].sort());
}
function safeObject(value = {}, name = 'metadata') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  const text = JSON.stringify(value);
  if (/"(?:secret|token|password|apiKey|api_key|accessToken|refreshToken|credentialValue)"\s*:/i.test(text)) throw new TypeError(`${name} must not contain secret material`);
  return Object.freeze(JSON.parse(text));
}
function publicRecord(record) {
  return Object.freeze({ ...record, grantedScopes: Object.freeze([...(record.grantedScopes ?? [])]), permissions: Object.freeze([...(record.permissions ?? [])]), capabilities: Object.freeze([...(record.capabilities ?? [])]), externalAccount: safeObject(record.externalAccount ?? {}, 'externalAccount'), provenance: safeObject(record.provenance ?? {}, 'provenance'), metadata: safeObject(record.metadata ?? {}, 'metadata') });
}
function defaultAuthorize({ actor, projectScope, permission, record }) {
  const actorId = required(actor?.globalUserId, 'actor.globalUserId');
  const grants = Array.isArray(actor?.grants) ? actor.grants : [];
  if (record?.projectScope !== projectScope) return { allowed: false, reason: 'connection-project-scope-mismatch' };
  if (record?.ownerGlobalUserId && record.ownerGlobalUserId !== actorId && !grants.includes('connection:manage:any')) return { allowed: false, reason: 'connection-owner-mismatch' };
  if (!grants.includes(permission) && !grants.includes('connection:*')) return { allowed: false, reason: 'connection-permission-denied' };
  return { allowed: true, reason: 'connection-authorized' };
}

export class ExternalConnectionError extends Error {
  constructor(message, { code = 'external-connection-error', retryable = false } = {}) { super(message); this.name = 'ExternalConnectionError'; this.code = code; this.retryable = retryable; }
}

export function createInMemoryExternalConnectionStore() {
  const records = new Map();
  return Object.freeze({
    async put(record) { records.set(record.connectionId, JSON.parse(JSON.stringify(record))); return this.get(record.connectionId); },
    async get(connectionId) { const value = records.get(connectionId); return value ? JSON.parse(JSON.stringify(value)) : null; },
    async list({ projectScope, ownerGlobalUserId = null, provider = null } = {}) { return [...records.values()].filter((r) => r.projectScope === projectScope && (!ownerGlobalUserId || r.ownerGlobalUserId === ownerGlobalUserId) && (!provider || r.provider === provider)).map((r) => JSON.parse(JSON.stringify(r))); }
  });
}

export function createExternalConnectionsRegistry({ store, clock = () => new Date(), audit = () => {}, authorize = defaultAuthorize, credentialManager = null } = {}) {
  if (!store || typeof store.put !== 'function' || typeof store.get !== 'function' || typeof store.list !== 'function') throw new TypeError('connection store with put/get/list is required');
  if (typeof clock !== 'function' || typeof audit !== 'function' || typeof authorize !== 'function') throw new TypeError('invalid registry dependency');

  async function emit(record, { actor, operation, outcome, reason = null, purpose = null }) {
    await audit(Object.freeze({ eventClass: 'external_connection', channel: 'audit', stage: 'external-connections-registry', outcome, actorRef: actor?.globalUserId ?? null, data: Object.freeze({ connectionId: record?.connectionId ?? null, provider: record?.provider ?? null, ownerGlobalUserId: record?.ownerGlobalUserId ?? null, projectScope: record?.projectScope ?? null, externalAccountId: record?.externalAccountId ?? null, operation, reason, purpose: optional(purpose) }) }));
  }
  function assertCredential(credentialId) {
    if (!credentialId || !credentialManager) return;
    credentialManager.describeCredential(credentialId);
  }
  function assertAuthorized(record, { actor, projectScope, permission, operation, purpose }) {
    const decision = authorize({ actor, projectScope, permission, record });
    if (!decision?.allowed) {
      void emit(record, { actor, operation, outcome: 'denied', reason: decision?.reason ?? 'connection-permission-denied', purpose });
      throw new ExternalConnectionError('external connection operation denied', { code: decision?.reason ?? 'connection-permission-denied' });
    }
  }
  async function getRequired(connectionId) {
    const record = await store.get(required(connectionId, 'connectionId'));
    if (!record) throw new ExternalConnectionError('external connection not found', { code: 'connection-not-found' });
    return record;
  }

  async function connect({ connectionId, provider, serviceType, ownerGlobalUserId = null, projectScope, externalAccountId, externalAccount = {}, credentialId = null, grantedScopes = [], permissions = [], capabilities = [], provenance = {}, metadata = {}, actor, purpose = 'connection-connect' } = {}) {
    const now = clock().toISOString();
    const record = {
      connectionId: required(connectionId, 'connectionId'), provider: required(provider, 'provider'), serviceType: required(serviceType, 'serviceType'), ownerGlobalUserId: optional(ownerGlobalUserId), projectScope: required(projectScope, 'projectScope'), externalAccountId: required(externalAccountId, 'externalAccountId'), externalAccount: safeObject(externalAccount, 'externalAccount'), credentialId: optional(credentialId), grantedScopes: uniqueStrings(grantedScopes, 'grantedScopes'), permissions: uniqueStrings(permissions, 'permissions'), capabilities: uniqueStrings(capabilities, 'capabilities'), status: 'connected', healthState: 'unknown', lastVerifiedAt: null, lastSuccessfulVerificationAt: null, revokedAt: null, provenance: safeObject(provenance, 'provenance'), metadata: safeObject(metadata, 'metadata'), createdAt: now, updatedAt: now
    };
    assertAuthorized(record, { actor, projectScope: record.projectScope, permission: 'connection:manage', operation: 'connect', purpose });
    assertCredential(record.credentialId);
    const existing = await store.get(record.connectionId);
    if (existing) throw new ExternalConnectionError('external connection already exists', { code: 'connection-already-exists' });
    const saved = await store.put(record);
    await emit(saved, { actor, operation: 'connect', outcome: 'success', purpose });
    return publicRecord(saved);
  }

  async function reconnect({ connectionId, actor, projectScope, credentialId, externalAccount = null, grantedScopes = null, permissions = null, capabilities = null, metadata = null, purpose = 'connection-reconnect' } = {}) {
    const current = await getRequired(connectionId);
    assertAuthorized(current, { actor, projectScope: required(projectScope, 'projectScope'), permission: 'connection:manage', operation: 'reconnect', purpose });
    const nextCredentialId = credentialId === undefined ? current.credentialId : optional(credentialId);
    assertCredential(nextCredentialId);
    const next = { ...current, credentialId: nextCredentialId, externalAccount: externalAccount == null ? current.externalAccount : safeObject(externalAccount, 'externalAccount'), grantedScopes: grantedScopes == null ? current.grantedScopes : uniqueStrings(grantedScopes, 'grantedScopes'), permissions: permissions == null ? current.permissions : uniqueStrings(permissions, 'permissions'), capabilities: capabilities == null ? current.capabilities : uniqueStrings(capabilities, 'capabilities'), metadata: metadata == null ? current.metadata : safeObject(metadata, 'metadata'), status: 'connected', healthState: 'unknown', revokedAt: null, updatedAt: clock().toISOString() };
    const saved = await store.put(next); await emit(saved, { actor, operation: 'reconnect', outcome: 'success', purpose }); return publicRecord(saved);
  }

  async function revoke({ connectionId, actor, projectScope, purpose = 'connection-revoke' } = {}) {
    const current = await getRequired(connectionId);
    assertAuthorized(current, { actor, projectScope: required(projectScope, 'projectScope'), permission: 'connection:manage', operation: 'revoke', purpose });
    const now = clock().toISOString();
    const saved = await store.put({ ...current, status: 'revoked', healthState: 'revoked', revokedAt: now, updatedAt: now });
    await emit(saved, { actor, operation: 'revoke', outcome: 'success', purpose }); return publicRecord(saved);
  }

  async function recordVerification({ connectionId, actor, projectScope, healthy, healthState = null, reason = null, purpose = 'connection-verification' } = {}) {
    const current = await getRequired(connectionId);
    assertAuthorized(current, { actor, projectScope: required(projectScope, 'projectScope'), permission: 'connection:verify', operation: 'verify', purpose });
    if (current.status === 'revoked') throw new ExternalConnectionError('revoked connection cannot be verified', { code: 'connection-revoked' });
    const health = healthState ?? (healthy ? 'healthy' : 'unavailable');
    if (!HEALTH.has(health)) throw new TypeError('invalid healthState');
    const now = clock().toISOString();
    const status = healthy ? 'connected' : (health === 'degraded' ? 'degraded' : 'unavailable');
    const saved = await store.put({ ...current, status, healthState: health, lastVerifiedAt: now, lastSuccessfulVerificationAt: healthy ? now : current.lastSuccessfulVerificationAt, updatedAt: now });
    await emit(saved, { actor, operation: 'verify', outcome: healthy ? 'success' : 'failed', reason, purpose }); return publicRecord(saved);
  }

  async function describe({ connectionId, actor, projectScope } = {}) {
    const record = await getRequired(connectionId);
    assertAuthorized(record, { actor, projectScope: required(projectScope, 'projectScope'), permission: 'connection:read', operation: 'describe', purpose: 'connection-discovery' });
    return publicRecord(record);
  }
  async function list({ actor, projectScope, ownerGlobalUserId = null, provider = null, includeUnavailable = true } = {}) {
    const scope = required(projectScope, 'projectScope');
    const probe = { projectScope: scope, ownerGlobalUserId: optional(ownerGlobalUserId) };
    assertAuthorized(probe, { actor, projectScope: scope, permission: 'connection:read', operation: 'list', purpose: 'connection-discovery' });
    const records = await store.list({ projectScope: scope, ownerGlobalUserId: optional(ownerGlobalUserId), provider: optional(provider) });
    const visible = records.filter((record) => authorize({ actor, projectScope: scope, permission: 'connection:read', record })?.allowed);
    return Object.freeze(visible.filter((r) => includeUnavailable || r.status === 'connected').map(publicRecord));
  }
  async function resolveCapability({ capability, actor, projectScope, provider = null } = {}) {
    const candidates = await list({ actor, projectScope, provider, includeUnavailable: false });
    return Object.freeze(candidates.filter((r) => r.capabilities.includes(required(capability, 'capability'))));
  }
  async function requireUsable({ connectionId, capability = null, actor, projectScope } = {}) {
    const record = await describe({ connectionId, actor, projectScope });
    if (!STATUSES.has(record.status) || record.status !== 'connected') throw new ExternalConnectionError('external connection is unavailable', { code: record.status === 'revoked' ? 'connection-revoked' : 'connection-unavailable', retryable: record.status !== 'revoked' });
    if (capability && !record.capabilities.includes(capability)) throw new ExternalConnectionError('connection does not provide requested capability', { code: 'connection-capability-unavailable' });
    return record;
  }

  return Object.freeze({ connect, reconnect, revoke, recordVerification, describe, list, resolveCapability, requireUsable });
}
