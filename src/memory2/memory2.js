import { createHash, randomUUID } from 'node:crypto';

export const MEMORY2_SCOPE_KINDS = Object.freeze(['user','user-group','group','thread','project']);
export const MEMORY2_PRIVACY_CLASSES = Object.freeze(['private','user-group','group','project','system','public']);
export const MEMORY2_LIFECYCLE_STATES = Object.freeze(['active','temporary','expired','superseded','archived','deleted']);
export const MEMORY2_TRUST_LEVELS = Object.freeze(['unverified','reported','confirmed','verified']);
export const MEMORY2_LAYERS = Object.freeze(['session','user-memory','user-group-memory','group-memory','thread-memory','project-memory','dialogue-archive','topic-digest','external-evidence','runtime-state']);

const SECRET_PATTERN = /(api[-_ ]?key|authorization|bearer\s+[a-z0-9._-]+|password|passwd|secret|token|private[-_ ]?key|credential)/i;
const TRUST_WEIGHT = Object.freeze({ unverified: 0, reported: 0.1, confirmed: 0.25, verified: 0.35 });
const ADMIN_ROLES = new Set(['monarch','owner','administrator','admin']);
const MANAGER_ROLES = new Set(['manager']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function iso(value, name, allowNull = true) {
  if (value == null && allowNull) return null;
  const text = required(value, name);
  if (Number.isNaN(Date.parse(text))) throw new TypeError(`${name} must be ISO timestamp`);
  return new Date(text).toISOString();
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function sha(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function fingerprint(value) { return sha(stable(value)); }
function uniq(values) { return [...new Set(values)]; }
function normalizeText(value) { return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function tokens(value) { return uniq(normalizeText(value).split(/\s+/u).filter((item) => item.length > 1)); }
function valueText(value) { return typeof value === 'string' ? value : stable(value); }
function jaccard(a, b) {
  const aa = new Set(tokens(a)); const bb = new Set(tokens(b));
  if (aa.size === 0 || bb.size === 0) return 0;
  let intersection = 0; for (const item of aa) if (bb.has(item)) intersection += 1;
  return intersection / (aa.size + bb.size - intersection);
}
function hasAny(set, values = []) { return values.some((item) => set.has(item)); }
function roleSet(actor) { return new Set((actor?.roles ?? []).map((item) => String(item).toLowerCase())); }
function grantSet(actor) { return new Set((actor?.grants ?? []).map(String)); }
function isAdmin(actor) { const roles = roleSet(actor); return hasAny(roles, [...ADMIN_ROLES]); }
function isManager(actor) { const roles = roleSet(actor); return isAdmin(actor) || hasAny(roles, [...MANAGER_ROLES]); }
function hasGrant(actor, name) { return grantSet(actor).has(name); }
function actorId(actor) { return optional(actor?.globalUserId ?? actor?.userScope); }
function sameNullable(a,b) { return (a ?? null) === (b ?? null); }
function sameResourceScope(a,b) { return a.projectScope === b.projectScope && sameNullable(a.groupScope,b.groupScope) && sameNullable(a.threadScope,b.threadScope); }
function sameMemoryScope(a,b) { return a.kind === b.kind && sameNullable(a.ownerGlobalUserId,b.ownerGlobalUserId) && sameResourceScope(a,b); }

export function createMemory2Scope(input = {}) {
  const kind = required(input.kind ?? 'user', 'scope.kind');
  if (!MEMORY2_SCOPE_KINDS.includes(kind)) throw new TypeError(`unsupported memory scope kind: ${kind}`);
  const ownerGlobalUserId = optional(input.ownerGlobalUserId ?? input.userScope ?? input.globalUserId);
  const projectScope = required(input.projectScope, 'scope.projectScope');
  const groupScope = optional(input.groupScope);
  const threadScope = optional(input.threadScope);
  if (threadScope && !groupScope) throw new TypeError('thread memory requires group scope');
  if (kind === 'user' && (!ownerGlobalUserId || groupScope || threadScope)) throw new TypeError('user scope requires owner and no group/thread');
  if (kind === 'user-group' && (!ownerGlobalUserId || !groupScope)) throw new TypeError('user-group scope requires owner and group');
  if (kind === 'group' && (ownerGlobalUserId || !groupScope || threadScope)) throw new TypeError('group scope requires group and no owner/thread');
  if (kind === 'thread' && (ownerGlobalUserId || !groupScope || !threadScope)) throw new TypeError('thread scope requires group/thread and no owner');
  if (kind === 'project' && (ownerGlobalUserId || groupScope || threadScope)) throw new TypeError('project scope cannot have owner/group/thread');
  return Object.freeze({ kind, ownerGlobalUserId, projectScope, groupScope, threadScope });
}

export function deriveMemory2Scope({ scope, scopeKind = null, shared = false } = {}) {
  if (!scope) throw new TypeError('scope is required');
  const owner = optional(scope.ownerGlobalUserId ?? scope.userScope ?? scope.globalUserId);
  const projectScope = required(scope.projectScope, 'scope.projectScope');
  const groupScope = optional(scope.groupScope);
  const threadScope = optional(scope.threadScope);
  let kind = scopeKind;
  if (!kind) {
    if (shared && threadScope) kind = 'thread';
    else if (shared && groupScope) kind = 'group';
    else if (shared) kind = 'project';
    else if (groupScope) kind = 'user-group';
    else kind = 'user';
  }
  const ownerGlobalUserId = ['user','user-group'].includes(kind) ? owner : null;
  return createMemory2Scope({ kind, ownerGlobalUserId, projectScope, groupScope, threadScope });
}

function defaultPrivacy(scope) {
  return Object.freeze({ user: 'private', 'user-group': 'user-group', group: 'group', thread: 'group', project: 'project' })[scope.kind];
}
function validatePrivacy(value, scope) {
  const privacy = required(value ?? defaultPrivacy(scope), 'privacyClass');
  if (!MEMORY2_PRIVACY_CLASSES.includes(privacy)) throw new TypeError(`unsupported privacy class: ${privacy}`);
  const expected = defaultPrivacy(scope);
  if (privacy === 'system') throw new TypeError('system/self knowledge is not ordinary Memory 2.0');
  if (privacy !== 'public' && privacy !== expected) throw new TypeError(`privacy ${privacy} is incompatible with ${scope.kind} scope`);
  return privacy;
}
function validateTrust(value) {
  const trust = required(value ?? 'unverified', 'trust');
  if (!MEMORY2_TRUST_LEVELS.includes(trust)) throw new TypeError(`unsupported trust level: ${trust}`);
  return trust;
}
function validateLifecycle(value) {
  const state = required(value ?? 'active', 'lifecycleState');
  if (!MEMORY2_LIFECYCLE_STATES.includes(state)) throw new TypeError(`unsupported lifecycle state: ${state}`);
  return state;
}
function validateLayer(value) {
  const layer = required(value, 'layer');
  if (!MEMORY2_LAYERS.includes(layer)) throw new TypeError(`unsupported memory layer: ${layer}`);
  return layer;
}
function expectedLayerForScope(scope) {
  if (scope.kind === 'group') return 'group-memory';
  if (scope.kind === 'thread') return 'thread-memory';
  if (scope.kind === 'user-group') return 'user-group-memory';
  if (scope.kind === 'project') return 'project-memory';
  return 'user-memory';
}
function boundedConfidence(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be 0..1');
  return number;
}
function secretSafe(value) {
  const text = valueText(value);
  if (SECRET_PATTERN.test(text)) {
    const error = new Error('secret-shaped data cannot enter Memory 2.0');
    error.code = 'memory-secret-rejected';
    throw error;
  }
}

export function createMemory2Record(input = {}) {
  const scope = createMemory2Scope(input.memoryScope ?? input.scope);
  const privacyClass = validatePrivacy(input.privacyClass, scope);
  const layer = validateLayer(input.layer ?? expectedLayerForScope(scope));
  const trust = validateTrust(input.trust ?? 'unverified');
  const lifecycleState = validateLifecycle(input.lifecycleState ?? 'active');
  const createdAt = iso(input.createdAt, 'createdAt', false);
  const updatedAt = iso(input.updatedAt ?? input.createdAt, 'updatedAt', false);
  const confirmed = input.confirmed === true;
  const confirmationState = required(input.confirmationState ?? (confirmed ? 'confirmed' : 'proposed'), 'confirmationState');
  if (!['proposed','confirmed','rejected'].includes(confirmationState)) throw new TypeError('invalid confirmationState');
  secretSafe(input.value);
  return Object.freeze({
    id: required(input.id ?? input.memoryId, 'id'),
    layer,
    key: required(input.key, 'key'),
    value: clone(input.value),
    memoryScope: scope,
    privacyClass,
    provenance: Object.freeze({
      sourceType: required(input.provenance?.sourceType, 'provenance.sourceType'),
      sourceId: required(input.provenance?.sourceId, 'provenance.sourceId'),
      actorId: optional(input.provenance?.actorId ?? input.creatorGlobalUserId),
      sourceTimestamp: iso(input.provenance?.sourceTimestamp, 'provenance.sourceTimestamp')
    }),
    trust,
    confirmed,
    confirmationState,
    lifecycleState,
    createdAt,
    updatedAt,
    lastAccessedAt: iso(input.lastAccessedAt, 'lastAccessedAt'),
    expiresAt: iso(input.expiresAt, 'expiresAt'),
    supersededAt: iso(input.supersededAt, 'supersededAt'),
    supersededBy: optional(input.supersededBy),
    archivedAt: iso(input.archivedAt, 'archivedAt'),
    deletedAt: iso(input.deletedAt, 'deletedAt'),
    tags: Object.freeze(uniq((input.tags ?? []).map((tag) => required(tag, 'tag')))),
    confidence: boundedConfidence(input.confidence),
    retentionClass: required(input.retentionClass ?? (lifecycleState === 'temporary' ? 'temporary' : 'durable'), 'retentionClass'),
    recordVersion: Number.isInteger(Number(input.recordVersion)) && Number(input.recordVersion) > 0 ? Number(input.recordVersion) : 1,
    semanticFingerprint: optional(input.semanticFingerprint) ?? fingerprint({ layer, key: input.key, value: input.value, scope }),
    metadata: Object.freeze(clone(input.metadata ?? {}))
  });
}

function canRead(record, actor, requestScope) {
  const id = actorId(actor);
  if (!id) return false;
  if (record.memoryScope.projectScope !== requestScope.projectScope) return false;
  if (record.privacyClass === 'private') return record.memoryScope.ownerGlobalUserId === id;
  if (record.privacyClass === 'user-group') return record.memoryScope.ownerGlobalUserId === id && record.memoryScope.groupScope === requestScope.groupScope;
  if (record.privacyClass === 'group') return record.memoryScope.groupScope === requestScope.groupScope && (record.memoryScope.threadScope == null || record.memoryScope.threadScope === requestScope.threadScope);
  if (record.privacyClass === 'project') return true;
  if (record.privacyClass === 'public') return true;
  return false;
}
function canCreate(scope, privacyClass, actor, requestScope, resourceAuthority) {
  const id = actorId(actor);
  if (!id || scope.projectScope !== requestScope.projectScope) return false;
  if (scope.kind === 'user') return scope.ownerGlobalUserId === id;
  if (scope.kind === 'user-group') return scope.ownerGlobalUserId === id && scope.groupScope === requestScope.groupScope;
  if (scope.kind === 'group' || scope.kind === 'thread') {
    if (scope.groupScope !== requestScope.groupScope) return false;
    if (scope.kind === 'thread' && scope.threadScope !== requestScope.threadScope) return false;
    return isManager(actor) || hasGrant(actor, 'memory:group:write') || resourceAuthority?.allowed === true;
  }
  if (scope.kind === 'project') return isAdmin(actor) || hasGrant(actor, 'memory:project:write');
  return privacyClass === 'public' && isAdmin(actor);
}
function canMutate(record, operation, actor, requestScope, resourceAuthority) {
  const id = actorId(actor);
  if (!id || record.memoryScope.projectScope !== requestScope.projectScope) return false;
  if (operation === 'read' || operation === 'history') return canRead(record, actor, requestScope);
  if (operation === 'confirm') {
    if (record.memoryScope.ownerGlobalUserId === id && ['user','user-group'].includes(record.memoryScope.kind)) return true;
    return isManager(actor) || hasGrant(actor, 'memory:confirm');
  }
  if (operation === 'promote') return isManager(actor) || hasGrant(actor, 'memory:promote');
  if (record.memoryScope.ownerGlobalUserId === id && ['user','user-group'].includes(record.memoryScope.kind)) return true;
  if (['group','thread'].includes(record.memoryScope.kind)) return isManager(actor) || hasGrant(actor, `memory:group:${operation}`) || resourceAuthority?.allowed === true;
  if (record.memoryScope.kind === 'project') return isAdmin(actor) || hasGrant(actor, `memory:project:${operation}`);
  return false;
}

export function createMemory2PermissionPolicy() {
  return Object.freeze({
    authorizeRead({ record, actor, requestScope }) { return canRead(record, actor, requestScope); },
    authorizeCreate({ scope, privacyClass, actor, requestScope, resourceAuthority = null }) { return canCreate(scope, privacyClass, actor, requestScope, resourceAuthority); },
    authorizeMutation({ record, operation, actor, requestScope, resourceAuthority = null }) { return canMutate(record, operation, actor, requestScope, resourceAuthority); }
  });
}

function captureClassification({ text, requestScope, metadata = {} }) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length < 3) return { worthy: false, reason: 'empty-or-short' };
  if (raw.length > 2000) return { worthy: false, reason: 'too-long' };
  if (SECRET_PATTERN.test(raw)) return { worthy: false, reason: 'sensitive' };
  const normalized = normalizeText(raw);
  const greetings = new Set(['hi','hello','hey','привет','привіт','добрый день','добрий день','дякую','спасибо','thanks','ok','okay']);
  if (greetings.has(normalized)) return { worthy: false, reason: 'chatter' };
  if (metadata.memoryCandidate?.key) {
    return {
      worthy: true,
      reason: 'structured-candidate',
      key: String(metadata.memoryCandidate.key),
      value: clone(metadata.memoryCandidate.value ?? raw),
      scopeKind: metadata.memoryCandidate.scopeKind ?? null,
      shared: metadata.memoryCandidate.shared === true,
      tags: metadata.memoryCandidate.tags ?? []
    };
  }
  const preferencePatterns = [
    /^(?:i prefer|i like)\s+(.+)/iu,
    /^(?:я предпочитаю|мне нравится)\s+(.+)/iu,
    /^(?:я віддаю перевагу|мені подобається)\s+(.+)/iu,
    /^(?:preferuję|lubię)\s+(.+)/iu
  ];
  for (const pattern of preferencePatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return { worthy: true, reason: 'personal-preference', key: `preference:${sha(normalizeText(match[1])).slice(0,12)}`, value: raw, scopeKind: requestScope.groupScope ? 'user-group' : 'user', shared: false, tags: ['preference','auto-captured'] };
  }
  const groupDecisionPatterns = [/(?:we decided|we agreed)/iu,/(?:мы решили|договорились)/iu,/(?:ми вирішили|домовились)/iu,/(?:ustaliliśmy|zdecydowaliśmy)/iu];
  if (requestScope.groupScope && groupDecisionPatterns.some((pattern) => pattern.test(raw))) {
    return { worthy: true, reason: 'group-decision', key: `group-decision:${sha(normalized).slice(0,12)}`, value: raw, scopeKind: requestScope.threadScope ? 'thread' : 'group', shared: true, tags: ['group-decision','auto-captured'] };
  }
  return { worthy: false, reason: 'low-value-or-uncertain' };
}

function recordConflictKey(record) {
  const scope = record.memoryScope;
  return [scope.kind, scope.ownerGlobalUserId ?? '-', scope.projectScope, scope.groupScope ?? '-', scope.threadScope ?? '-', record.layer, record.key].join('|');
}
function isCurrent(record, nowMs) {
  if (!['active','temporary'].includes(record.lifecycleState)) return false;
  if (record.expiresAt && Date.parse(record.expiresAt) <= nowMs) return false;
  return true;
}
function scoreRecord(record, queryTerms, keys, nowMs) {
  const keyNorm = normalizeText(record.key);
  const text = normalizeText(`${record.key} ${record.tags.join(' ')} ${valueText(record.value)}`);
  let score = 0;
  if (keys.has(record.key)) score += 5;
  for (const term of queryTerms) {
    if (keyNorm.includes(term)) score += 2;
    else if (text.includes(term)) score += 1;
  }
  score += TRUST_WEIGHT[record.trust] ?? 0;
  if (record.confirmed) score += 0.35;
  if (record.memoryScope.kind === 'user-group' || record.memoryScope.kind === 'thread') score += 0.15;
  else if (record.memoryScope.kind === 'user' || record.memoryScope.kind === 'group') score += 0.1;
  const ageDays = Math.max(0, (nowMs - Date.parse(record.updatedAt)) / 86400000);
  score += Math.max(0, 0.2 - Math.min(0.2, ageDays / 365));
  return score;
}

export function createMemory2Service({ store, clock = () => new Date(), permissionPolicy = createMemory2PermissionPolicy(), audit = () => {}, maxCandidates = 500 } = {}) {
  if (!store?.insert || !store?.list || !store?.get || !store?.update) throw new TypeError('Memory2 store must implement insert/list/get/update');
  if (typeof clock !== 'function' || typeof audit !== 'function') throw new TypeError('invalid Memory2 dependency');

  async function emit(event) { await Promise.resolve(audit(Object.freeze(clone(event)))); }
  function requestScopeFrom(scope) {
    return Object.freeze({ userScope: optional(scope.userScope ?? scope.globalUserId ?? scope.ownerGlobalUserId), projectScope: required(scope.projectScope, 'requestScope.projectScope'), groupScope: optional(scope.groupScope), threadScope: optional(scope.threadScope) });
  }
  function actorFrom(actor, requestScope) {
    return Object.freeze({ globalUserId: actorId(actor) ?? requestScope.userScope, roles: Object.freeze([...(actor?.roles ?? [])]), grants: Object.freeze([...(actor?.grants ?? [])]), authenticationLevel: actor?.authenticationLevel ?? 'verified' });
  }

  async function authorizedCandidates({ requestScope, actor, includeHistory = false, layers = [], keys = [] }) {
    const rows = await store.list({ projectScope: requestScope.projectScope, groupScope: requestScope.groupScope, threadScope: requestScope.threadScope, ownerGlobalUserId: actor.globalUserId, includeHistory, limit: maxCandidates });
    const layerSet = new Set(layers); const keySet = new Set(keys);
    const allowed = []; let excludedPrivacy = 0; let excludedLifecycle = 0; let excludedScope = 0;
    const nowMs = clock().getTime();
    for (const raw of rows) {
      const record = createMemory2Record(raw);
      if (!permissionPolicy.authorizeRead({ record, actor, requestScope })) { excludedPrivacy += 1; continue; }
      if (!includeHistory && !isCurrent(record, nowMs)) { excludedLifecycle += 1; continue; }
      if (layerSet.size && !layerSet.has(record.layer)) continue;
      if (keySet.size && !keySet.has(record.key)) continue;
      if (record.memoryScope.kind === 'thread' && record.memoryScope.threadScope !== requestScope.threadScope) { excludedScope += 1; continue; }
      allowed.push(record);
    }
    return { records: allowed, excludedPrivacy, excludedLifecycle, excludedScope };
  }

  async function write(input = {}) {
    const requestScope = requestScopeFrom(input.requestScope ?? input.scope ?? {});
    const actor = actorFrom(input.actor ?? null, requestScope);
    const memoryScope = deriveMemory2Scope({ scope: input.scope ?? requestScope, scopeKind: input.scopeKind ?? null, shared: input.shared === true });
    const privacyClass = validatePrivacy(input.privacyClass, memoryScope);
    if (!permissionPolicy.authorizeCreate({ scope: memoryScope, privacyClass, actor, requestScope, resourceAuthority: input.resourceAuthority ?? null })) {
      await emit({ eventClass: 'memory_write_denied', reason: 'privacy-or-scope-policy', actorGlobalUserId: actor.globalUserId, scopeKind: memoryScope.kind, projectScope: requestScope.projectScope });
      const error = new Error('memory write denied by scope/privacy policy'); error.code = 'memory-write-denied'; throw error;
    }
    secretSafe(input.value);
    const now = clock().toISOString();
    const layer = validateLayer(input.layer ?? expectedLayerForScope(memoryScope));
    const trust = validateTrust(input.trust ?? (input.confirmed ? 'confirmed' : 'reported'));
    const confirmed = input.confirmed === true;
    if (input.automatic === true && confirmed) { const error = new Error('automatic capture cannot create confirmed truth'); error.code = 'memory-auto-confirmation-denied'; throw error; }
    const semanticFingerprint = fingerprint({ layer, key: input.key, value: input.value, scope: memoryScope });
    const existing = await store.list({ projectScope: memoryScope.projectScope, groupScope: memoryScope.groupScope, threadScope: memoryScope.threadScope, ownerGlobalUserId: memoryScope.ownerGlobalUserId, includeHistory: false, limit: maxCandidates });
    const sameKey = existing.map(createMemory2Record).filter((item) => item.layer === layer && item.key === input.key && sameMemoryScope(item.memoryScope, memoryScope) && ['active','temporary'].includes(item.lifecycleState));
    const duplicate = sameKey.find((item) => item.semanticFingerprint === semanticFingerprint || stable(item.value) === stable(input.value) || jaccard(valueText(item.value), valueText(input.value)) >= 0.96);
    if (duplicate) {
      await emit({ eventClass: 'memory_duplicate', memoryId: duplicate.id, actorGlobalUserId: actor.globalUserId, scopeKind: memoryScope.kind, projectScope: memoryScope.projectScope });
      return Object.freeze({ status: 'duplicate', record: duplicate, conflictIds: Object.freeze([]) });
    }
    const id = input.id ?? randomUUID();
    const record = createMemory2Record({
      id, layer, key: required(input.key, 'key'), value: input.value, memoryScope, privacyClass,
      provenance: { sourceType: required(input.provenance?.sourceType ?? (input.automatic ? 'automatic-capture' : 'memory2-write'), 'provenance.sourceType'), sourceId: required(input.provenance?.sourceId ?? id, 'provenance.sourceId'), actorId: actor.globalUserId, sourceTimestamp: input.provenance?.sourceTimestamp ?? now },
      trust, confirmed, confirmationState: confirmed ? 'confirmed' : 'proposed', lifecycleState: input.lifecycleState ?? (input.temporary ? 'temporary' : 'active'),
      createdAt: now, updatedAt: now, expiresAt: input.expiresAt ?? null, tags: input.tags ?? [], confidence: input.confidence ?? null,
      retentionClass: input.retentionClass ?? (input.temporary ? 'temporary' : 'durable'), semanticFingerprint, metadata: input.metadata ?? {}
    });
    const stored = createMemory2Record(await store.insert(record));
    const conflictIds = sameKey.filter((item) => stable(item.value) !== stable(stored.value)).map((item) => item.id);
    await emit({ eventClass: 'memory_written', memoryId: stored.id, actorGlobalUserId: actor.globalUserId, scopeKind: memoryScope.kind, privacyClass, projectScope: memoryScope.projectScope, conflictCount: conflictIds.length, automatic: input.automatic === true });
    return Object.freeze({ status: conflictIds.length ? 'conflict' : 'written', record: stored, conflictIds: Object.freeze(conflictIds) });
  }

  async function capture({ text, scope, actor, metadata = {}, resourceAuthority = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const classification = captureClassification({ text, requestScope, metadata });
    if (!classification.worthy) {
      await emit({ eventClass: 'memory_capture_suppressed', reason: classification.reason, actorGlobalUserId: resolvedActor.globalUserId, projectScope: requestScope.projectScope });
      return Object.freeze({ status: 'suppressed', reason: classification.reason });
    }
    const targetScope = deriveMemory2Scope({ scope: requestScope, scopeKind: classification.scopeKind, shared: classification.shared });
    const privacyClass = defaultPrivacy(targetScope);
    if (!permissionPolicy.authorizeCreate({ scope: targetScope, privacyClass, actor: resolvedActor, requestScope, resourceAuthority })) {
      await emit({ eventClass: 'memory_capture_proposed_not_persisted', reason: 'write-policy-denied', actorGlobalUserId: resolvedActor.globalUserId, scopeKind: targetScope.kind, projectScope: requestScope.projectScope });
      return Object.freeze({ status: 'proposed', persisted: false, reason: 'write-policy-denied', targetScope });
    }
    const result = await write({ automatic: true, layer: expectedLayerForScope(targetScope), key: classification.key, value: classification.value, scope: requestScope, scopeKind: targetScope.kind, shared: classification.shared, privacyClass, actor: resolvedActor, resourceAuthority, provenance: { sourceType: 'automatic-capture', sourceId: metadata.sourceId ?? metadata.platformMessageId ?? `capture:${sha(String(text)).slice(0,16)}` }, trust: 'reported', confirmed: false, tags: classification.tags, confidence: 0.6, metadata: { captureReason: classification.reason } });
    return Object.freeze({ status: result.status, persisted: true, reason: classification.reason, ...result });
  }

  async function queryScoped({ scope, actor = null, layers = [], keys = [], now = clock().toISOString(), includeHistory = false } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const result = await authorizedCandidates({ requestScope, actor: resolvedActor, includeHistory, layers, keys });
    const nowMs = Date.parse(now);
    const current = [];
    let excludedExpired = 0;
    for (const record of result.records) {
      if (!includeHistory && record.expiresAt && Date.parse(record.expiresAt) <= nowMs) { excludedExpired += 1; continue; }
      current.push(record);
    }
    current.sort((a,b) => a.layer.localeCompare(b.layer) || a.key.localeCompare(b.key) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return Object.freeze({ records: Object.freeze(current), diagnostics: Object.freeze({ excludedExpired: excludedExpired + result.excludedLifecycle, excludedScope: result.excludedScope, excludedPrivacy: result.excludedPrivacy, returnedCount: current.length }) });
  }

  async function recall({ scope, actor = null, query = '', layers = [], keys = [], maxRecords = 20, maxCharacters = 12000, includeHistory = false } = {}) {
    if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 100) throw new TypeError('maxRecords must be 1..100');
    if (!Number.isInteger(maxCharacters) || maxCharacters < 1000 || maxCharacters > 100000) throw new TypeError('maxCharacters must be 1000..100000');
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const candidates = await authorizedCandidates({ requestScope, actor: resolvedActor, includeHistory, layers, keys });
    const nowMs = clock().getTime(); const queryTerms = tokens(query); const keySet = new Set(keys);
    const ranked = candidates.records.map((record) => ({ record, score: scoreRecord(record, queryTerms, keySet, nowMs) })).sort((a,b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt) || a.record.id.localeCompare(b.record.id));
    const selected = []; let chars = 0; let excludedBudget = 0;
    for (const candidate of ranked) {
      const size = JSON.stringify(candidate.record).length;
      if (selected.length >= maxRecords || chars + size > maxCharacters) { excludedBudget += 1; continue; }
      selected.push(Object.freeze({ ...candidate.record, recallScore: Number(candidate.score.toFixed(4)) })); chars += size;
    }
    const groups = new Map();
    for (const record of selected) { const key = recordConflictKey(record); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); }
    const conflicts = [...groups.entries()].filter(([,items]) => new Set(items.map((item) => stable(item.value))).size > 1).map(([key,items]) => Object.freeze({ key, memoryIds: Object.freeze(items.map((item) => item.id)) }));
    await emit({ eventClass: 'memory_recall', actorGlobalUserId: resolvedActor.globalUserId, projectScope: requestScope.projectScope, candidateCount: ranked.length, selectedCount: selected.length, excludedPrivacy: candidates.excludedPrivacy, excludedBudget, conflictCount: conflicts.length });
    return Object.freeze({ records: Object.freeze(selected), conflicts: Object.freeze(conflicts), diagnostics: Object.freeze({ candidateCount: ranked.length, returnedCount: selected.length, excludedPrivacy: candidates.excludedPrivacy, excludedLifecycle: candidates.excludedLifecycle, excludedScope: candidates.excludedScope, excludedBudget, truncated: excludedBudget > 0, conflictCount: conflicts.length }) });
  }

  async function consolidate({ scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const { records } = await authorizedCandidates({ requestScope, actor: resolvedActor, includeHistory: false, layers: [], keys: [] });
    const grouped = new Map();
    for (const record of records) { const key = recordConflictKey(record); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(record); }
    let duplicates = 0, superseded = 0, conflicts = 0;
    for (const items of grouped.values()) {
      if (items.length < 2) continue;
      const byValue = new Map();
      for (const item of items) { const key = stable(item.value); if (!byValue.has(key)) byValue.set(key, []); byValue.get(key).push(item); }
      for (const duplicatesGroup of byValue.values()) {
        if (duplicatesGroup.length < 2) continue;
        duplicatesGroup.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
        const keep = duplicatesGroup[0];
        for (const duplicate of duplicatesGroup.slice(1)) {
          if (duplicate.lifecycleState === 'archived') continue;
          await store.update(duplicate.id, { lifecycleState: 'archived', archivedAt: clock().toISOString(), metadata: { ...duplicate.metadata, duplicateOf: keep.id } }); duplicates += 1;
        }
      }
      if (byValue.size > 1) {
        const current = items.filter((item) => item.lifecycleState === 'active' || item.lifecycleState === 'temporary');
        const confirmed = current.filter((item) => item.confirmed);
        if (confirmed.length >= 1) {
          confirmed.sort((a,b) => (TRUST_WEIGHT[b.trust] - TRUST_WEIGHT[a.trust]) || b.updatedAt.localeCompare(a.updatedAt));
          const winner = confirmed[0];
          for (const older of current) {
            if (older.id === winner.id || !older.confirmed) continue;
            if (Date.parse(older.updatedAt) <= Date.parse(winner.updatedAt) && older.lifecycleState !== 'superseded') {
              await store.update(older.id, { lifecycleState: 'superseded', supersededAt: clock().toISOString(), supersededBy: winner.id }); superseded += 1;
            }
          }
          const unresolved = current.filter((item) => !item.confirmed || (item.id !== winner.id && Date.parse(item.updatedAt) > Date.parse(winner.updatedAt)));
          if (unresolved.length) conflicts += 1;
        } else conflicts += 1;
      }
    }
    await emit({ eventClass: 'memory_consolidation', actorGlobalUserId: resolvedActor.globalUserId, projectScope: requestScope.projectScope, duplicateArchivedCount: duplicates, supersededCount: superseded, conflictGroupCount: conflicts });
    return Object.freeze({ duplicatesArchived: duplicates, superseded, conflicts });
  }

  async function createDigest({ scope, actor = null, topic, maxSources = 20 } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const recalled = await recall({ scope: requestScope, actor: resolvedActor, query: topic, maxRecords: maxSources, maxCharacters: 20000 });
    if (!recalled.records.length) return Object.freeze({ status: 'empty', record: null });
    const sourceIds = recalled.records.map((item) => item.id);
    const digest = recalled.records.map((item) => `${item.key}: ${valueText(item.value)}`).join('\n').slice(0,8000);
    return write({ layer: 'topic-digest', key: `digest:${normalizeText(topic) || 'general'}`, value: { topic, digest, sourceIds }, scope: requestScope, scopeKind: requestScope.groupScope ? 'user-group' : 'user', actor: resolvedActor, provenance: { sourceType: 'memory-consolidation', sourceId: `digest:${sha(sourceIds.join('|')).slice(0,16)}` }, trust: 'reported', confirmed: false, tags: ['topic-digest', normalizeText(topic) || 'general'], confidence: 0.7, metadata: { sourceIds } });
  }

  async function confirm({ memoryId, scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const found = await store.get(required(memoryId,'memoryId')); if (!found) return null;
    const record = createMemory2Record(found);
    if (!permissionPolicy.authorizeMutation({ record, operation: 'confirm', actor: resolvedActor, requestScope })) { const error = new Error('memory confirmation denied'); error.code = 'memory-confirm-denied'; throw error; }
    const updated = createMemory2Record(await store.update(record.id, { confirmed: true, confirmationState: 'confirmed', trust: record.trust === 'verified' ? 'verified' : 'confirmed', updatedAt: clock().toISOString() }));
    await emit({ eventClass: 'memory_confirmed', memoryId: record.id, actorGlobalUserId: resolvedActor.globalUserId, projectScope: requestScope.projectScope });
    return updated;
  }

  async function promote({ memoryId, scope, actor = null, targetScopeKind, resourceAuthority = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const found = await store.get(required(memoryId,'memoryId')); if (!found) return null;
    const record = createMemory2Record(found);
    if (!permissionPolicy.authorizeMutation({ record, operation: 'promote', actor: resolvedActor, requestScope, resourceAuthority })) { const error = new Error('memory promotion denied'); error.code = 'memory-promote-denied'; throw error; }
    const target = deriveMemory2Scope({ scope: requestScope, scopeKind: targetScopeKind, shared: ['group','thread','project'].includes(targetScopeKind) });
    const result = await write({ layer: expectedLayerForScope(target), key: record.key, value: record.value, scope: requestScope, scopeKind: target.kind, shared: ['group','thread','project'].includes(target.kind), actor: resolvedActor, resourceAuthority, provenance: { sourceType: 'memory-promotion', sourceId: record.id }, trust: record.trust, confirmed: record.confirmed, tags: [...record.tags,'promoted'], confidence: record.confidence, metadata: { promotedFrom: record.id } });
    await emit({ eventClass: 'memory_promoted', memoryId: record.id, newMemoryId: result.record.id, actorGlobalUserId: resolvedActor.globalUserId, fromScopeKind: record.memoryScope.kind, toScopeKind: target.kind, projectScope: requestScope.projectScope });
    return result;
  }

  async function archive({ memoryId, scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope); const found = await store.get(required(memoryId,'memoryId')); if (!found) return null; const record = createMemory2Record(found);
    if (!permissionPolicy.authorizeMutation({ record, operation: 'archive', actor: resolvedActor, requestScope })) { const error = new Error('memory archive denied'); error.code = 'memory-archive-denied'; throw error; }
    return createMemory2Record(await store.update(record.id, { lifecycleState: 'archived', archivedAt: clock().toISOString(), updatedAt: clock().toISOString() }));
  }

  async function remove({ memoryId, scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope); const found = await store.get(required(memoryId,'memoryId')); if (!found) return null; const record = createMemory2Record(found);
    if (!permissionPolicy.authorizeMutation({ record, operation: 'delete', actor: resolvedActor, requestScope })) { const error = new Error('memory delete denied'); error.code = 'memory-delete-denied'; throw error; }
    if (record.confirmed && record.retentionClass === 'permanent') { const error = new Error('permanent confirmed memory cannot be generically deleted'); error.code = 'memory-retention-protected'; throw error; }
    return createMemory2Record(await store.update(record.id, { lifecycleState: 'deleted', deletedAt: clock().toISOString(), updatedAt: clock().toISOString() }));
  }

  async function reconcileLifecycle({ projectScope = null } = {}) {
    const now = clock(); const rows = await store.list({ projectScope, includeHistory: true, limit: maxCandidates }); let expired = 0;
    for (const raw of rows) {
      const record = createMemory2Record(raw);
      if (['active','temporary'].includes(record.lifecycleState) && record.expiresAt && Date.parse(record.expiresAt) <= now.getTime()) {
        await store.update(record.id, { lifecycleState: 'expired', updatedAt: now.toISOString() }); expired += 1;
      }
    }
    await emit({ eventClass: 'memory_lifecycle_reconciled', projectScope, expiredCount: expired });
    return Object.freeze({ expired });
  }

  async function diagnostics({ scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope);
    const permitted = await authorizedCandidates({ requestScope, actor: resolvedActor, includeHistory: true, layers: [], keys: [] });
    const byLifecycle = {}, byPrivacy = {}, byScopeKind = {}; const groups = new Map();
    for (const record of permitted.records) {
      byLifecycle[record.lifecycleState] = (byLifecycle[record.lifecycleState] ?? 0) + 1;
      byPrivacy[record.privacyClass] = (byPrivacy[record.privacyClass] ?? 0) + 1;
      byScopeKind[record.memoryScope.kind] = (byScopeKind[record.memoryScope.kind] ?? 0) + 1;
      const key = recordConflictKey(record); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record);
    }
    let duplicateCount = 0, conflictCount = 0;
    for (const items of groups.values()) {
      const values = items.map((item) => stable(item.value));
      duplicateCount += values.length - new Set(values).size;
      if (new Set(values).size > 1 && items.some((item) => ['active','temporary'].includes(item.lifecycleState))) conflictCount += 1;
    }
    return Object.freeze({ total: permitted.records.length, byLifecycle: Object.freeze(byLifecycle), byPrivacy: Object.freeze(byPrivacy), byScopeKind: Object.freeze(byScopeKind), duplicateCount, conflictCount, expiredCount: byLifecycle.expired ?? 0, excludedPrivacy: permitted.excludedPrivacy });
  }

  async function inspect({ memoryId, scope, actor = null } = {}) {
    const requestScope = requestScopeFrom(scope ?? {}); const resolvedActor = actorFrom(actor, requestScope); const found = await store.get(required(memoryId,'memoryId')); if (!found) return null; const record = createMemory2Record(found);
    if (!permissionPolicy.authorizeMutation({ record, operation: 'history', actor: resolvedActor, requestScope })) return null;
    const chain = [record]; let next = record.supersededBy; const seen = new Set([record.id]);
    while (next && !seen.has(next) && chain.length < 50) { seen.add(next); const row = await store.get(next); if (!row) break; chain.push(createMemory2Record(row)); next = row.supersededBy ?? null; }
    return Object.freeze({ record, chain: Object.freeze(chain), provenance: record.provenance });
  }

  async function integrityCheck({ projectScope = null } = {}) {
    const rows = await store.list({ projectScope, includeHistory: true, limit: maxCandidates }); const issues = [];
    const ids = new Set(rows.map((row) => row.id ?? row.memoryId ?? row.memory_id));
    for (const raw of rows) {
      try {
        const record = createMemory2Record(raw);
        if (record.supersededBy && !ids.has(record.supersededBy)) issues.push({ code: 'missing-supersession-target', memoryId: record.id });
        if (record.memoryScope.kind === 'thread' && !record.memoryScope.threadScope) issues.push({ code: 'thread-scope-invalid', memoryId: record.id });
      } catch (error) { issues.push({ code: 'record-invalid', memoryId: raw.id ?? raw.memory_id ?? null, reason: error.message }); }
    }
    return Object.freeze({ ok: issues.length === 0, issueCount: issues.length, issues: Object.freeze(issues) });
  }

  return Object.freeze({ write, capture, queryScoped, recall, consolidate, createDigest, confirm, promote, archive, delete: remove, reconcileLifecycle, diagnostics, inspect, integrityCheck, permissionPolicy });
}

export function createMemory2Provider({ service, clock = () => new Date() } = {}) {
  if (!service?.write || !service?.queryScoped) throw new TypeError('Memory2 service is required');
  return Object.freeze({
    name: 'memory-2-provider',
    memory2: service,
    async write(rawRequest = {}) {
      const scope = rawRequest.scope ?? {};
      const actor = rawRequest.actor ?? { globalUserId: scope.userScope, roles: rawRequest.roles ?? [], grants: rawRequest.grants ?? [], authenticationLevel: 'verified' };
      const layer = rawRequest.layer ?? 'user-memory';
      const explicitShared = ['group-memory','thread-memory'].includes(layer) || rawRequest.shared === true || ['group','thread','project'].includes(rawRequest.scopeKind);
      if (!explicitShared && ['user-memory','project-memory'].includes(layer) && rawRequest.confirmed !== true) throw new TypeError('confirmed memory layers require confirmed=true');
      if (layer === 'dialogue-archive' && rawRequest.confirmed === true) throw new TypeError('dialogue archive cannot be written as confirmed memory');
      return service.write({ ...rawRequest, scope, actor, shared: explicitShared });
    },
    async query({ scope, layers, keys = [], now = clock().toISOString(), actor = null, includeHistory = false } = {}) {
      return service.queryScoped({ scope, actor: actor ?? { globalUserId: scope.userScope, roles: [], grants: [], authenticationLevel: 'verified' }, layers, keys, now, includeHistory });
    },
    async recall(args) { return service.recall(args); },
    async capture(args) { return service.capture(args); },
    async diagnostics(args) { return service.diagnostics(args); },
    async consolidate(args) { return service.consolidate(args); },
    async reconcileLifecycle(args) { return service.reconcileLifecycle(args); }
  });
}
