export const RESOURCE_RELATIONS = Object.freeze(['owns','administers','manages','can_read','can_publish','can_modify']);
const RELATION_SET = new Set(RESOURCE_RELATIONS);
const IMPLIED = Object.freeze({
  owns: new Set(RESOURCE_RELATIONS),
  administers: new Set(['administers','manages','can_read','can_publish','can_modify']),
  manages: new Set(['manages','can_read','can_publish','can_modify']),
  can_modify: new Set(['can_modify','can_read']),
  can_publish: new Set(['can_publish','can_read']),
  can_read: new Set(['can_read'])
});

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function relation(value) {
  const normalized = required(value, 'relation');
  if (!RELATION_SET.has(normalized)) throw new TypeError(`unsupported resource relation: ${normalized}`);
  return normalized;
}
function safeObject(value = {}, name = 'metadata') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  const text = JSON.stringify(value);
  if (/"(?:secret|token|password|apiKey|api_key|accessToken|refreshToken|credentialValue)"\s*:/i.test(text)) throw new TypeError(`${name} must not contain secret material`);
  return Object.freeze(JSON.parse(text));
}
function isoOrNull(value, name) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid date`);
  return date.toISOString();
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function publicResource(record) { return Object.freeze({ ...clone(record), metadata: safeObject(record.metadata ?? {}), provenance: safeObject(record.provenance ?? {}, 'provenance') }); }
function publicAuthority(record, clock) {
  const expired = record.expiresAt && new Date(record.expiresAt).getTime() <= clock().getTime();
  return Object.freeze({ ...clone(record), effectiveState: expired && record.state === 'active' ? 'expired' : record.state, provenance: safeObject(record.provenance ?? {}, 'provenance') });
}
function actorGrants(actor) { return Array.isArray(actor?.grants) ? actor.grants : []; }
function canManageRegistry(actor) { const grants = actorGrants(actor); return grants.includes('resource-authority:manage') || grants.includes('resource-authority:*'); }
function canReadRegistry(actor) { const grants = actorGrants(actor); return canManageRegistry(actor) || grants.includes('resource-authority:read') || grants.includes('resource-authority:*'); }
function relationSatisfies(granted, requiredRelation) { return IMPLIED[granted]?.has(requiredRelation) === true; }

export class ResourceAuthorityError extends Error {
  constructor(message, { code = 'resource-authority-error', retryable = false } = {}) { super(message); this.name = 'ResourceAuthorityError'; this.code = code; this.retryable = retryable; }
}

export function createInMemoryResourceAuthorityStore() {
  const resources = new Map();
  const authorities = new Map();
  return Object.freeze({
    async putResource(record) { resources.set(record.resourceId, clone(record)); return this.getResource(record.resourceId); },
    async getResource(resourceId) { const record = resources.get(resourceId); return record ? clone(record) : null; },
    async listResources({ projectScope, provider = null } = {}) { return [...resources.values()].filter((r) => r.projectScope === projectScope && (!provider || r.provider === provider)).map(clone); },
    async putAuthority(record) { authorities.set(record.authorityId, clone(record)); return this.getAuthority(record.authorityId); },
    async getAuthority(authorityId) { const record = authorities.get(authorityId); return record ? clone(record) : null; },
    async listAuthorities({ projectScope, actorGlobalUserId = null, resourceId = null, includeRevoked = false } = {}) { return [...authorities.values()].filter((a) => a.projectScope === projectScope && (!actorGlobalUserId || a.actorGlobalUserId === actorGlobalUserId) && (!resourceId || a.resourceId === resourceId) && (includeRevoked || a.state === 'active')).map(clone); }
  });
}

export function createResourceAuthorityRegistry({ store, connectionRegistry = null, clock = () => new Date(), audit = () => {} } = {}) {
  if (!store?.putResource || !store?.getResource || !store?.listResources || !store?.putAuthority || !store?.getAuthority || !store?.listAuthorities) throw new TypeError('resource authority store is required');
  if (typeof clock !== 'function' || typeof audit !== 'function') throw new TypeError('invalid resource authority dependency');

  async function emit({ actor, resource = null, authority = null, operation, outcome, reason = null, purpose = null }) {
    await audit(Object.freeze({ eventClass: 'resource_authority', channel: 'audit', stage: 'resource-authority', outcome, actorRef: actor?.globalUserId ?? null, data: Object.freeze({ resourceId: resource?.resourceId ?? authority?.resourceId ?? null, authorityId: authority?.authorityId ?? null, authorityActor: authority?.actorGlobalUserId ?? null, relation: authority?.relation ?? null, projectScope: resource?.projectScope ?? authority?.projectScope ?? null, operation, reason, purpose: optional(purpose) }) }));
  }
  function assertManage(actor) { if (!canManageRegistry(actor)) throw new ResourceAuthorityError('resource authority management denied', { code: 'resource-authority-manage-denied' }); }
  function assertRead(actor) { if (!canReadRegistry(actor)) throw new ResourceAuthorityError('resource authority read denied', { code: 'resource-authority-read-denied' }); }
  async function getResourceRequired(resourceId) { const record = await store.getResource(required(resourceId, 'resourceId')); if (!record) throw new ResourceAuthorityError('resource not found', { code: 'resource-not-found' }); return record; }
  async function ancestors(resource, projectScope) {
    const chain = [];
    const seen = new Set([resource.resourceId]);
    let parentId = resource.parentResourceId;
    while (parentId) {
      if (seen.has(parentId)) throw new ResourceAuthorityError('resource hierarchy cycle detected', { code: 'resource-hierarchy-cycle' });
      seen.add(parentId);
      const parent = await getResourceRequired(parentId);
      if (parent.projectScope !== projectScope) throw new ResourceAuthorityError('resource hierarchy crosses project scope', { code: 'resource-project-scope-mismatch' });
      chain.push(parent);
      parentId = parent.parentResourceId;
    }
    return chain;
  }
  async function assertConnection(connectionId, projectScope, actor) {
    if (!connectionId || !connectionRegistry) return;
    await connectionRegistry.describe({ connectionId, actor, projectScope });
  }

  async function registerResource({ resourceId, resourceType, provider, projectScope, connectionId = null, externalResourceId, parentResourceId = null, verificationState = 'unverified', metadata = {}, provenance = {}, actor, purpose = 'resource-register' } = {}) {
    assertManage(actor);
    const id = required(resourceId, 'resourceId');
    if (await store.getResource(id)) throw new ResourceAuthorityError('resource already exists', { code: 'resource-already-exists' });
    const project = required(projectScope, 'projectScope');
    if (!['unverified','verified','rejected'].includes(verificationState)) throw new TypeError('invalid verificationState');
    if (connectionId) await assertConnection(connectionId, project, actor);
    if (parentResourceId) {
      const parent = await getResourceRequired(parentResourceId);
      if (parent.projectScope !== project) throw new ResourceAuthorityError('parent resource project mismatch', { code: 'resource-project-scope-mismatch' });
      if (parent.resourceId === id) throw new ResourceAuthorityError('resource cannot be its own parent', { code: 'resource-hierarchy-cycle' });
      await ancestors(parent, project);
    }
    const now = clock().toISOString();
    const record = { resourceId: id, resourceType: required(resourceType, 'resourceType'), provider: required(provider, 'provider'), projectScope: project, connectionId: optional(connectionId), externalResourceId: required(externalResourceId, 'externalResourceId'), parentResourceId: optional(parentResourceId), verificationState, metadata: safeObject(metadata), provenance: safeObject(provenance, 'provenance'), createdAt: now, updatedAt: now };
    const saved = await store.putResource(record); await emit({ actor, resource: saved, operation: 'register', outcome: 'success', purpose }); return publicResource(saved);
  }

  async function setResourceVerification({ resourceId, projectScope, verificationState, provenance = null, actor, purpose = 'resource-verify' } = {}) {
    assertManage(actor);
    if (!['unverified','verified','rejected'].includes(verificationState)) throw new TypeError('invalid verificationState');
    const resource = await getResourceRequired(resourceId);
    if (resource.projectScope !== required(projectScope, 'projectScope')) throw new ResourceAuthorityError('resource project scope mismatch', { code: 'resource-project-scope-mismatch' });
    const saved = await store.putResource({ ...resource, verificationState, provenance: provenance == null ? resource.provenance : safeObject(provenance, 'provenance'), updatedAt: clock().toISOString() });
    await emit({ actor, resource: saved, operation: 'verify-resource', outcome: 'success', purpose }); return publicResource(saved);
  }

  async function checkAuthority({ actorGlobalUserId, resourceId, projectScope, relation: requiredRelation, includeHierarchy = true } = {}) {
    const actorId = required(actorGlobalUserId, 'actorGlobalUserId');
    const project = required(projectScope, 'projectScope');
    const needed = relation(requiredRelation);
    const resource = await getResourceRequired(resourceId);
    if (resource.projectScope !== project) return Object.freeze({ allowed: false, reason: 'resource-project-scope-mismatch', resourceId: resource.resourceId, requiredRelation: needed, evidence: null });
    if (resource.verificationState !== 'verified') return Object.freeze({ allowed: false, reason: 'resource-not-verified', resourceId: resource.resourceId, requiredRelation: needed, evidence: null });
    const candidates = [resource, ...(includeHierarchy ? await ancestors(resource, project) : [])];
    for (const candidate of candidates) {
      const authorities = await store.listAuthorities({ projectScope: project, actorGlobalUserId: actorId, resourceId: candidate.resourceId, includeRevoked: false });
      for (const authority of authorities) {
        const visible = publicAuthority(authority, clock);
        if (visible.effectiveState !== 'active' || visible.verificationState !== 'verified') continue;
        if (candidate.resourceId !== resource.resourceId && !visible.appliesToDescendants) continue;
        if (!relationSatisfies(visible.relation, needed)) continue;
        return Object.freeze({ allowed: true, reason: 'resource-authority-verified', resourceId: resource.resourceId, requiredRelation: needed, evidence: Object.freeze({ authorityId: visible.authorityId, authorityResourceId: visible.resourceId, relation: visible.relation, inherited: visible.resourceId !== resource.resourceId, verificationSource: visible.verificationSource }) });
      }
    }
    return Object.freeze({ allowed: false, reason: 'resource-authority-missing', resourceId: resource.resourceId, requiredRelation: needed, evidence: null });
  }

  async function grantAuthority({ authorityId, resourceId, actorGlobalUserId, projectScope, relation: grantedRelation, appliesToDescendants = false, delegatedByGlobalUserId = null, verificationState = 'verified', verificationSource, provenance = {}, expiresAt = null, actor, purpose = 'authority-grant' } = {}) {
    assertManage(actor);
    const project = required(projectScope, 'projectScope');
    const resource = await getResourceRequired(resourceId);
    if (resource.projectScope !== project) throw new ResourceAuthorityError('resource project scope mismatch', { code: 'resource-project-scope-mismatch' });
    if (resource.verificationState !== 'verified') throw new ResourceAuthorityError('authority cannot be granted for unverified resource', { code: 'resource-not-verified' });
    const rel = relation(grantedRelation);
    const delegate = optional(delegatedByGlobalUserId);
    if (!['unverified','verified','rejected'].includes(verificationState)) throw new TypeError('invalid verificationState');
    if (delegate) {
      const delegation = await checkAuthority({ actorGlobalUserId: delegate, resourceId: resource.resourceId, projectScope: project, relation: rel });
      if (!delegation.allowed) throw new ResourceAuthorityError('delegator lacks requested authority', { code: 'authority-delegation-denied' });
    }
    const id = required(authorityId, 'authorityId');
    if (await store.getAuthority(id)) throw new ResourceAuthorityError('authority already exists', { code: 'authority-already-exists' });
    const now = clock().toISOString();
    const record = { authorityId: id, resourceId: resource.resourceId, actorGlobalUserId: required(actorGlobalUserId, 'actorGlobalUserId'), projectScope: project, relation: rel, appliesToDescendants: Boolean(appliesToDescendants), delegatedByGlobalUserId: delegate, verificationState, verificationSource: required(verificationSource, 'verificationSource'), provenance: safeObject(provenance, 'provenance'), state: 'active', verifiedAt: verificationState === 'verified' ? now : null, expiresAt: isoOrNull(expiresAt, 'expiresAt'), revokedAt: null, createdAt: now, updatedAt: now };
    const saved = await store.putAuthority(record); await emit({ actor, authority: saved, operation: delegate ? 'delegate' : 'grant', outcome: 'success', purpose }); return publicAuthority(saved, clock);
  }

  async function revokeAuthority({ authorityId, projectScope, actor, purpose = 'authority-revoke' } = {}) {
    assertManage(actor);
    const authority = await store.getAuthority(required(authorityId, 'authorityId'));
    if (!authority) throw new ResourceAuthorityError('authority not found', { code: 'authority-not-found' });
    if (authority.projectScope !== required(projectScope, 'projectScope')) throw new ResourceAuthorityError('authority project scope mismatch', { code: 'resource-project-scope-mismatch' });
    const now = clock().toISOString();
    const saved = await store.putAuthority({ ...authority, state: 'revoked', revokedAt: now, updatedAt: now });
    await emit({ actor, authority: saved, operation: 'revoke', outcome: 'success', purpose }); return publicAuthority(saved, clock);
  }

  async function describeResource({ resourceId, projectScope, actor } = {}) {
    assertRead(actor); const resource = await getResourceRequired(resourceId);
    if (resource.projectScope !== required(projectScope, 'projectScope')) throw new ResourceAuthorityError('resource project scope mismatch', { code: 'resource-project-scope-mismatch' });
    return publicResource(resource);
  }
  async function listResources({ projectScope, provider = null, actor } = {}) { assertRead(actor); return Object.freeze((await store.listResources({ projectScope: required(projectScope, 'projectScope'), provider: optional(provider) })).map(publicResource)); }
  async function listAuthorities({ projectScope, actorGlobalUserId = null, resourceId = null, includeRevoked = false, actor } = {}) { assertRead(actor); return Object.freeze((await store.listAuthorities({ projectScope: required(projectScope, 'projectScope'), actorGlobalUserId: optional(actorGlobalUserId), resourceId: optional(resourceId), includeRevoked })).map((a) => publicAuthority(a, clock))); }

  return Object.freeze({ registerResource, setResourceVerification, grantAuthority, revokeAuthority, describeResource, listResources, listAuthorities, checkAuthority });
}
