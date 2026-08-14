import { createHash } from 'node:crypto';

export const CREDENTIAL_TYPES = Object.freeze(['api-key', 'bot-token', 'oauth', 'service-credential']);
const CREDENTIAL_STATES = new Set(['active', 'revoked']);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value) {
  return value == null || String(value).trim() === '' ? null : String(value).trim();
}

function isoOrNull(value, name) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid date`);
  return date.toISOString();
}

function cloneJson(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function assertSafeMetadata(metadata) {
  const serialized = JSON.stringify(metadata ?? {});
  if (/"(?:secret|token|password|apiKey|api_key|accessToken|refreshToken)"\s*:/i.test(serialized)) {
    throw new TypeError('credential metadata must not contain secret material');
  }
  return Object.freeze(cloneJson(metadata ?? {}));
}

export class CredentialAccessError extends Error {
  constructor(message, { code = 'credential-access-denied', retryable = false } = {}) {
    super(message);
    this.name = 'CredentialAccessError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function createEnvironmentSecretStore({ env = process.env } = {}) {
  return Object.freeze({
    name: 'environment',
    async read(reference) {
      const key = requiredString(reference?.key, 'environment secret key');
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new CredentialAccessError('invalid environment secret reference', { code: 'credential-secret-ref-invalid' });
      const value = env[key];
      if (typeof value !== 'string' || value === '') throw new CredentialAccessError('credential secret is unavailable', { code: 'credential-secret-unavailable' });
      return value;
    }
  });
}

export function createInMemorySecretStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return Object.freeze({
    name: 'memory',
    async read(reference) {
      const key = requiredString(reference?.key, 'memory secret key');
      if (!values.has(key)) throw new CredentialAccessError('credential secret is unavailable', { code: 'credential-secret-unavailable' });
      return values.get(key);
    },
    set(key, value) { values.set(requiredString(key, 'memory secret key'), requiredString(value, 'secret value')); },
    delete(key) { values.delete(requiredString(key, 'memory secret key')); }
  });
}

export function createSecretStoreRouter({ stores = [] } = {}) {
  const registry = new Map();
  for (const store of stores) {
    const name = requiredString(store?.name, 'secret store name');
    if (typeof store.read !== 'function') throw new TypeError(`secret store ${name} must implement read()`);
    if (registry.has(name)) throw new TypeError(`duplicate secret store ${name}`);
    registry.set(name, store);
  }
  return Object.freeze({
    async read(reference) {
      const provider = requiredString(reference?.provider, 'secret store provider');
      const store = registry.get(provider);
      if (!store) throw new CredentialAccessError('secret store is unavailable', { code: 'credential-store-unavailable' });
      return store.read(reference);
    },
    providers: Object.freeze([...registry.keys()])
  });
}

function defaultAuthorizer({ record, actor, scope, permission }) {
  const globalUserId = requiredString(actor?.globalUserId, 'credential actor globalUserId');
  const projectScope = requiredString(scope?.projectScope, 'credential project scope');
  const grants = Array.isArray(actor?.grants) ? actor.grants : [];
  if (record.ownerUserId && record.ownerUserId !== globalUserId) return { allowed: false, reason: 'credential-user-scope-mismatch' };
  if (record.projectScope && record.projectScope !== projectScope) return { allowed: false, reason: 'credential-project-scope-mismatch' };
  if (!grants.includes(permission) && !grants.includes('credential:*')) return { allowed: false, reason: 'credential-permission-denied' };
  return { allowed: true, reason: 'credential-access-authorized' };
}

function publicRecord(record, clock) {
  const now = clock().getTime();
  const expired = record.expiresAt != null && new Date(record.expiresAt).getTime() <= now;
  return Object.freeze({
    credentialId: record.credentialId,
    type: record.type,
    state: expired && record.state === 'active' ? 'expired' : record.state,
    ownerUserId: record.ownerUserId,
    projectScope: record.projectScope,
    connectionId: record.connectionId,
    resourceId: record.resourceId,
    requiredPermission: record.requiredPermission,
    version: record.version,
    createdAt: record.createdAt,
    rotatedAt: record.rotatedAt,
    revokedAt: record.revokedAt,
    expiresAt: record.expiresAt,
    storeProvider: record.secretRef.provider,
    metadata: record.metadata
  });
}

export function createCredentialManager({ secretStore, clock = () => new Date(), audit = () => {}, authorize = defaultAuthorizer } = {}) {
  if (!secretStore || typeof secretStore.read !== 'function') throw new TypeError('secretStore.read is required');
  if (typeof clock !== 'function' || typeof audit !== 'function' || typeof authorize !== 'function') throw new TypeError('invalid credential manager dependency');
  const records = new Map();

  function emit(record, { actor = null, purpose = null, outcome, reason = null, operation = 'use' }) {
    audit(Object.freeze({
      eventClass: 'credential_access',
      channel: 'audit',
      stage: 'secrets-credentials',
      outcome,
      actorRef: actor?.globalUserId ?? null,
      data: Object.freeze({
        credentialId: record?.credentialId ?? null,
        connectionId: record?.connectionId ?? null,
        resourceId: record?.resourceId ?? null,
        projectScope: record?.projectScope ?? null,
        purpose: optionalString(purpose),
        operation,
        reason
      })
    }));
  }

  function registerCredential({ credentialId, type, secretRef, ownerUserId = null, projectScope = null, connectionId = null, resourceId = null, requiredPermission = 'credential:use', expiresAt = null, metadata = {} } = {}) {
    const id = requiredString(credentialId, 'credentialId');
    if (!CREDENTIAL_TYPES.includes(type)) throw new TypeError(`credential type must be one of: ${CREDENTIAL_TYPES.join(', ')}`);
    if (records.has(id)) throw new TypeError(`credential already registered: ${id}`);
    const provider = requiredString(secretRef?.provider, 'secretRef.provider');
    const now = clock().toISOString();
    const record = {
      credentialId: id,
      type,
      secretRef: Object.freeze({ ...cloneJson(secretRef), provider }),
      ownerUserId: optionalString(ownerUserId),
      projectScope: optionalString(projectScope),
      connectionId: optionalString(connectionId),
      resourceId: optionalString(resourceId),
      requiredPermission: requiredString(requiredPermission, 'requiredPermission'),
      state: 'active', version: 1, createdAt: now, rotatedAt: null, revokedAt: null,
      expiresAt: isoOrNull(expiresAt, 'expiresAt'), metadata: assertSafeMetadata(metadata)
    };
    records.set(id, record);
    return publicRecord(record, clock);
  }

  function getRecord(credentialId) {
    const id = requiredString(credentialId, 'credentialId');
    const record = records.get(id);
    if (!record) throw new CredentialAccessError('credential is not registered', { code: 'credential-not-found' });
    return record;
  }

  function assertUsable(record, { actor, scope, permission, purpose, connectionId = null, resourceId = null, operation = 'use' }) {
    const state = publicRecord(record, clock).state;
    if (state === 'revoked') {
      emit(record, { actor, purpose, outcome: 'denied', reason: 'credential-revoked', operation });
      throw new CredentialAccessError('credential is revoked', { code: 'credential-revoked' });
    }
    if (state === 'expired') {
      emit(record, { actor, purpose, outcome: 'denied', reason: 'credential-expired', operation });
      throw new CredentialAccessError('credential is expired', { code: 'credential-expired' });
    }
    if (record.connectionId && record.connectionId !== optionalString(connectionId)) {
      emit(record, { actor, purpose, outcome: 'denied', reason: 'credential-connection-scope-mismatch', operation });
      throw new CredentialAccessError('credential connection scope mismatch', { code: 'credential-scope-mismatch' });
    }
    if (record.resourceId && record.resourceId !== optionalString(resourceId)) {
      emit(record, { actor, purpose, outcome: 'denied', reason: 'credential-resource-scope-mismatch', operation });
      throw new CredentialAccessError('credential resource scope mismatch', { code: 'credential-scope-mismatch' });
    }
    const authorization = authorize({ record: publicRecord(record, clock), actor, scope, permission });
    if (!authorization?.allowed) {
      emit(record, { actor, purpose, outcome: 'denied', reason: authorization?.reason ?? 'credential-permission-denied', operation });
      throw new CredentialAccessError('credential access denied', { code: authorization?.reason ?? 'credential-permission-denied' });
    }
  }

  async function useCredential({ credentialId, actor, scope, purpose, permission = null, connectionId = null, resourceId = null, operation } = {}) {
    const record = getRecord(credentialId);
    const effectivePermission = permission ?? record.requiredPermission;
    assertUsable(record, { actor, scope, permission: effectivePermission, purpose, connectionId, resourceId, operation: 'use' });
    if (typeof operation !== 'function') throw new TypeError('credential operation callback is required');
    let raw;
    try { raw = await secretStore.read(record.secretRef); }
    catch (error) {
      emit(record, { actor, purpose, outcome: 'failed', reason: error?.code ?? 'credential-secret-unavailable', operation: 'use' });
      if (error instanceof CredentialAccessError) throw error;
      throw new CredentialAccessError('credential secret is unavailable', { code: 'credential-secret-unavailable', retryable: true });
    }
    emit(record, { actor, purpose, outcome: 'authorized', reason: 'credential-use-started', operation: 'use' });
    try {
      const result = await operation(raw, publicRecord(record, clock));
      emit(record, { actor, purpose, outcome: 'success', reason: null, operation: 'use' });
      return result;
    } catch (error) {
      emit(record, { actor, purpose, outcome: 'failed', reason: error?.code ?? 'credential-consumer-failed', operation: 'use' });
      throw error;
    } finally {
      raw = undefined;
    }
  }

  function rotateCredential({ credentialId, secretRef, actor, scope, purpose = 'credential-rotation', permission = 'credential:manage' } = {}) {
    const record = getRecord(credentialId);
    assertUsable(record, { actor, scope, permission, purpose, connectionId: record.connectionId, resourceId: record.resourceId, operation: 'rotate' });
    record.secretRef = Object.freeze({ ...cloneJson(secretRef), provider: requiredString(secretRef?.provider, 'secretRef.provider') });
    record.state = 'active'; record.version += 1; record.rotatedAt = clock().toISOString(); record.revokedAt = null;
    emit(record, { actor, purpose, outcome: 'success', operation: 'rotate' });
    return publicRecord(record, clock);
  }

  function revokeCredential({ credentialId, actor, scope, purpose = 'credential-revocation', permission = 'credential:manage' } = {}) {
    const record = getRecord(credentialId);
    if (!CREDENTIAL_STATES.has(record.state)) throw new Error('invalid credential state');
    const authorization = authorize({ record: publicRecord(record, clock), actor, scope, permission });
    if (!authorization?.allowed) {
      emit(record, { actor, purpose, outcome: 'denied', reason: authorization?.reason ?? 'credential-permission-denied', operation: 'revoke' });
      throw new CredentialAccessError('credential access denied', { code: authorization?.reason ?? 'credential-permission-denied' });
    }
    record.state = 'revoked'; record.revokedAt = clock().toISOString();
    emit(record, { actor, purpose, outcome: 'success', operation: 'revoke' });
    return publicRecord(record, clock);
  }

  return Object.freeze({
    registerCredential,
    describeCredential: (credentialId) => publicRecord(getRecord(credentialId), clock),
    listCredentials: () => Object.freeze([...records.values()].map((record) => publicRecord(record, clock))),
    useCredential,
    rotateCredential,
    revokeCredential
  });
}

export function createDeploymentCredentialManager({ env = process.env, observability = null, clock = () => new Date(), projectScope = 'sg2.1' } = {}) {
  const environmentStore = createEnvironmentSecretStore({ env });
  const derivedStore = Object.freeze({
    name: 'derived-sha256',
    async read(reference) {
      const source = await environmentStore.read({ key: reference?.sourceKey });
      const prefix = String(reference?.prefix ?? '');
      return createHash('sha256').update(`${prefix}${source}`).digest('hex');
    }
  });
  const secretStore = createSecretStoreRouter({ stores: [environmentStore, derivedStore] });
  const audit = (event) => observability?.record?.(event);
  const manager = createCredentialManager({ secretStore, clock, audit });
  const systemOwner = 'system:runtime';
  const common = { ownerUserId: systemOwner, projectScope, requiredPermission: 'credential:use:system' };
  if (typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY !== '') manager.registerCredential({ credentialId: 'sg.openai.primary', type: 'api-key', secretRef: { provider: 'environment', key: 'OPENAI_API_KEY' }, connectionId: 'openai', ...common });
  const telegramTokenKey = typeof env.TELEGRAM_BOT_TOKEN === 'string' && env.TELEGRAM_BOT_TOKEN !== '' ? 'TELEGRAM_BOT_TOKEN' : (typeof env.BOT_TOKEN === 'string' && env.BOT_TOKEN !== '' ? 'BOT_TOKEN' : null);
  if (telegramTokenKey) {
    manager.registerCredential({ credentialId: 'sg.telegram.bot', type: 'bot-token', secretRef: { provider: 'environment', key: telegramTokenKey }, connectionId: 'telegram', ...common });
    const webhookRef = typeof env.TELEGRAM_WEBHOOK_SECRET === 'string' && env.TELEGRAM_WEBHOOK_SECRET !== ''
      ? { provider: 'environment', key: 'TELEGRAM_WEBHOOK_SECRET' }
      : { provider: 'derived-sha256', sourceKey: telegramTokenKey, prefix: 'sg2.1:telegram-webhook:' };
    manager.registerCredential({ credentialId: 'sg.telegram.webhook', type: 'service-credential', secretRef: webhookRef, connectionId: 'telegram-webhook', ...common });
  }
  const accessContext = Object.freeze({
    actor: Object.freeze({ globalUserId: systemOwner, roles: Object.freeze(['system']), grants: Object.freeze(['credential:use:system', 'credential:manage']) }),
    scope: Object.freeze({ projectScope })
  });
  return Object.freeze({ manager, accessContext, providers: secretStore.providers });
}
