import { randomUUID } from 'node:crypto';

const ACTION_POLICIES = Object.freeze({
  'workspace:view': Object.freeze({ relation: 'can_read', roles: Object.freeze(['OWNER', 'ADMIN', 'EDITOR', 'MODERATOR', 'VIEWER']), sensitive: false }),
  'workspace:configure': Object.freeze({ relation: 'administers', roles: Object.freeze(['OWNER', 'ADMIN']), sensitive: true }),
  'workspace:manage': Object.freeze({ relation: 'administers', roles: Object.freeze(['OWNER', 'ADMIN']), sensitive: true }),
  'workspace:publish': Object.freeze({ relation: 'can_publish', roles: Object.freeze(['OWNER', 'ADMIN', 'EDITOR']), sensitive: true }),
  'workspace:moderate': Object.freeze({ relation: 'can_modify', roles: Object.freeze(['OWNER', 'ADMIN', 'MODERATOR']), sensitive: true })
});

const TELEGRAM_AUTHORITY = Object.freeze({ creator: 'OWNER', administrator: 'ADMIN' });
const ROLE_RELATION = Object.freeze({ OWNER: 'owns', ADMIN: 'administers', EDITOR: 'manages', MODERATOR: 'can_modify', VIEWER: 'can_read' });

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function telegramUserId(value) {
  const id = required(String(value), 'telegramUserId');
  if (!/^\d+$/.test(id)) throw new TypeError('telegramUserId must be integer-compatible');
  return id;
}
function timestamp(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function rowValue(row, camel, snake) { return row?.[camel] ?? row?.[snake] ?? null; }
function effectiveWorkspaceRole(existing, telegramRole) {
  if (!existing || rowValue(existing, 'status', 'status') !== 'active') return telegramRole;
  const current = String(rowValue(existing, 'role', 'role') ?? '').toUpperCase();
  if (!ROLE_RELATION[current]) return telegramRole;
  if (telegramRole === 'ADMIN' && current === 'OWNER') return 'ADMIN';
  return current;
}
function publicTelegramEvidence(member, verifiedAt) {
  return Object.freeze({ source: 'telegram.getChatMember', status: String(member?.status ?? 'unknown'), verifiedAt: verifiedAt.toISOString() });
}
function deny({ reason, workspaceId, requestedAction, globalUserId = null, workspaceRole = null, telegramEvidence = null, verificationTime = null }) {
  return Object.freeze({ allowed: false, reason, workspaceId, requestedAction, globalUserId, workspaceRole, resourceRelation: null, resourceAuthority: null, telegramEvidence, verificationTime });
}
async function fetchTelegramMember(telegramApiClient, chatId, userId) {
  if (typeof telegramApiClient?.getChatMember === 'function') return telegramApiClient.getChatMember({ chatId, userId });
  if (typeof telegramApiClient?.call === 'function') return telegramApiClient.call('getChatMember', { chat_id: chatId, user_id: userId });
  throw new TypeError('telegramApiClient.getChatMember or telegramApiClient.call is required');
}

export const TELEGRAM_WORKSPACE_AUTHORITY_ACTIONS = ACTION_POLICIES;

export function createTelegramWorkspaceAuthorityResolver({
  workspaceStore,
  identityLinks,
  telegramApiClient,
  resourceAuthorityRegistry,
  resourceAuthorityAccessContext,
  projectScope,
  clock = () => new Date(),
  authorityTtlMs = 5 * 60 * 1000,
  idFactory = () => `twa_${randomUUID()}`,
  audit = async () => {}
} = {}) {
  if (!workspaceStore?.getWorkspace || !workspaceStore?.getMember || !workspaceStore?.putMember) throw new TypeError('workspaceStore is required');
  if (!identityLinks?.resolve) throw new TypeError('identityLinks.resolve is required');
  if (!telegramApiClient || (typeof telegramApiClient.getChatMember !== 'function' && typeof telegramApiClient.call !== 'function')) throw new TypeError('telegramApiClient is required');
  for (const method of ['describeResource', 'registerResource', 'setResourceVerification', 'listAuthorities', 'grantAuthority', 'revokeAuthority', 'checkAuthority']) {
    if (typeof resourceAuthorityRegistry?.[method] !== 'function') throw new TypeError(`resourceAuthorityRegistry.${method} is required`);
  }
  if (!resourceAuthorityAccessContext?.actor) throw new TypeError('resourceAuthorityAccessContext.actor is required');
  const project = required(projectScope, 'projectScope');
  if (typeof clock !== 'function' || !Number.isFinite(authorityTtlMs) || authorityTtlMs <= 0 || typeof idFactory !== 'function' || typeof audit !== 'function') throw new TypeError('invalid authority resolver dependency');

  async function emit(decision) {
    await audit(Object.freeze({ eventClass: 'telegram_workspace_authority', outcome: decision.allowed ? 'allow' : 'deny', workspaceId: decision.workspaceId, actorGlobalUserId: decision.globalUserId, requestedAction: decision.requestedAction, workspaceRole: decision.workspaceRole, reason: decision.reason, verificationTime: decision.verificationTime }));
    return decision;
  }

  async function ensureManagedResource(workspace, verifiedAt) {
    const actor = resourceAuthorityAccessContext.actor;
    let resource = null;
    try { resource = await resourceAuthorityRegistry.describeResource({ resourceId: workspace.workspaceId, projectScope: project, actor }); }
    catch (error) { if (error?.code !== 'resource-not-found') throw error; }
    if (!resource) {
      return resourceAuthorityRegistry.registerResource({
        resourceId: workspace.workspaceId,
        resourceType: 'telegram_workspace',
        provider: 'telegram',
        projectScope: project,
        externalResourceId: String(workspace.telegramChatId),
        verificationState: 'verified',
        metadata: { workspaceType: workspace.workspaceType },
        provenance: { source: 'twm1.4', verifiedAt: verifiedAt.toISOString() },
        actor,
        purpose: 'twm1.4.workspace-resource-register'
      });
    }
    if (resource.provider !== 'telegram' || resource.resourceType !== 'telegram_workspace') {
      const error = new Error('workspace resource identity conflicts with existing Resource Authority resource');
      error.code = 'twm-workspace-resource-conflict';
      throw error;
    }
    if (resource.verificationState !== 'verified') {
      resource = await resourceAuthorityRegistry.setResourceVerification({ resourceId: workspace.workspaceId, projectScope: project, verificationState: 'verified', provenance: { source: 'twm1.4', verifiedAt: verifiedAt.toISOString(), telegramChatId: String(workspace.telegramChatId) }, actor, purpose: 'twm1.4.workspace-resource-verify' });
    }
    return resource;
  }

  async function revokeActiveAuthorities({ workspaceId, globalUserId, purpose }) {
    const actor = resourceAuthorityAccessContext.actor;
    const authorities = await resourceAuthorityRegistry.listAuthorities({ projectScope: project, actorGlobalUserId: globalUserId, resourceId: workspaceId, includeRevoked: false, actor });
    for (const authority of authorities) {
      if (authority.effectiveState === 'active' || authority.state === 'active') await resourceAuthorityRegistry.revokeAuthority({ authorityId: authority.authorityId, projectScope: project, actor, purpose });
    }
  }

  async function reconcileAllowedAuthority({ workspace, globalUserId, role, telegramEvidence, verifiedAt }) {
    await ensureManagedResource(workspace, verifiedAt);
    await revokeActiveAuthorities({ workspaceId: workspace.workspaceId, globalUserId, purpose: 'twm1.4.authority-refresh' });
    const expiresAt = new Date(verifiedAt.getTime() + authorityTtlMs).toISOString();
    return resourceAuthorityRegistry.grantAuthority({
      authorityId: idFactory(), resourceId: workspace.workspaceId, actorGlobalUserId: globalUserId, projectScope: project,
      relation: ROLE_RELATION[role], verificationState: 'verified', verificationSource: 'telegram.getChatMember',
      provenance: { telegramStatus: telegramEvidence.status, workspaceRole: role, verifiedAt: verifiedAt.toISOString() }, expiresAt,
      actor: resourceAuthorityAccessContext.actor, purpose: 'twm1.4.telegram-authority-verified'
    });
  }

  async function cachedDecision({ workspace, globalUserId, policy, requestedAction, now }) {
    const member = await workspaceStore.getMember({ workspaceId: workspace.workspaceId, globalUserId });
    if (!member || rowValue(member, 'status', 'status') !== 'active') return null;
    const updatedAt = timestamp(rowValue(member, 'updatedAt', 'updated_at'));
    if (!updatedAt || now.getTime() - updatedAt.getTime() >= authorityTtlMs) return null;
    const role = String(rowValue(member, 'role', 'role') ?? '').toUpperCase();
    if (!policy.roles.includes(role)) return deny({ reason: 'twm-workspace-role-denied', workspaceId: workspace.workspaceId, requestedAction, globalUserId, workspaceRole: role, verificationTime: updatedAt.toISOString() });
    let authority;
    try { authority = await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: globalUserId, resourceId: workspace.workspaceId, projectScope: project, relation: policy.relation, includeHierarchy: false }); }
    catch { return null; }
    if (!authority.allowed) return null;
    return Object.freeze({ allowed: true, reason: 'twm-workspace-authority-cached', workspaceId: workspace.workspaceId, requestedAction, globalUserId, workspaceRole: role, resourceRelation: policy.relation, resourceAuthority: authority.evidence, telegramEvidence: Object.freeze({ source: 'telegram.getChatMember', status: 'cached-authority', verifiedAt: updatedAt.toISOString() }), verificationTime: updatedAt.toISOString() });
  }

  async function verify({ workspaceId, telegramUserId: rawTelegramUserId, requestedAction, expectedGlobalUserId = null, forceFresh = false } = {}) {
    const canonicalWorkspaceId = required(workspaceId, 'workspaceId');
    const action = required(requestedAction, 'requestedAction');
    const policy = ACTION_POLICIES[action];
    if (!policy) return emit(deny({ reason: 'twm-workspace-action-unsupported', workspaceId: canonicalWorkspaceId, requestedAction: action }));

    const platformUserId = telegramUserId(rawTelegramUserId);
    const identityLink = await identityLinks.resolve('telegram', platformUserId);
    const globalUserId = rowValue(identityLink, 'globalUserId', 'global_user_id');
    if (!globalUserId) return emit(deny({ reason: 'twm-telegram-identity-link-missing', workspaceId: canonicalWorkspaceId, requestedAction: action }));
    if (expectedGlobalUserId != null && required(expectedGlobalUserId, 'expectedGlobalUserId') !== globalUserId) return emit(deny({ reason: 'twm-telegram-identity-link-mismatch', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId }));

    const workspace = await workspaceStore.getWorkspace(canonicalWorkspaceId);
    if (!workspace) return emit(deny({ reason: 'twm-workspace-not-found', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId }));

    const now = clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
    if (!policy.sensitive && !forceFresh) {
      const cached = await cachedDecision({ workspace, globalUserId, policy, requestedAction: action, now });
      if (cached) return emit(cached);
    }

    let telegramMember;
    try { telegramMember = await fetchTelegramMember(telegramApiClient, workspace.telegramChatId, platformUserId); }
    catch (error) { return emit(deny({ reason: error?.code ?? 'twm-telegram-authority-verification-failed', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId })); }

    const verifiedAt = clock();
    const telegramEvidence = publicTelegramEvidence(telegramMember, verifiedAt);
    const telegramRole = TELEGRAM_AUTHORITY[telegramEvidence.status] ?? null;
    const existing = await workspaceStore.getMember({ workspaceId: canonicalWorkspaceId, globalUserId });

    if (!telegramRole) {
      if (existing) {
        const existingRole = String(rowValue(existing, 'role', 'role') ?? 'VIEWER').toUpperCase();
        await workspaceStore.putMember({ workspaceId: canonicalWorkspaceId, globalUserId, role: ROLE_RELATION[existingRole] ? existingRole : 'VIEWER', status: 'revoked', source: 'telegram:getChatMember' });
      }
      await revokeActiveAuthorities({ workspaceId: canonicalWorkspaceId, globalUserId, purpose: 'twm1.4.telegram-authority-lost' });
      return emit(deny({ reason: 'twm-telegram-resource-authority-denied', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId, telegramEvidence, verificationTime: verifiedAt.toISOString() }));
    }

    const role = effectiveWorkspaceRole(existing, telegramRole);
    await workspaceStore.putMember({ workspaceId: canonicalWorkspaceId, globalUserId, role, status: 'active', source: 'telegram:getChatMember' });
    const grantedAuthority = await reconcileAllowedAuthority({ workspace, globalUserId, role, telegramEvidence, verifiedAt });

    if (!policy.roles.includes(role)) return emit(deny({ reason: 'twm-workspace-role-denied', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId, workspaceRole: role, telegramEvidence, verificationTime: verifiedAt.toISOString() }));

    const authority = await resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: globalUserId, resourceId: canonicalWorkspaceId, projectScope: project, relation: policy.relation, includeHierarchy: false });
    if (!authority.allowed) return emit(deny({ reason: authority.reason ?? 'twm-resource-authority-denied', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId, workspaceRole: role, telegramEvidence, verificationTime: verifiedAt.toISOString() }));

    return emit(Object.freeze({ allowed: true, reason: 'twm-workspace-authority-verified', workspaceId: canonicalWorkspaceId, requestedAction: action, globalUserId, workspaceRole: role, resourceRelation: policy.relation, resourceAuthority: Object.freeze({ ...authority.evidence, grantAuthorityId: grantedAuthority.authorityId, expiresAt: grantedAuthority.expiresAt }), telegramEvidence, verificationTime: verifiedAt.toISOString() }));
  }

  return Object.freeze({ verify });
}

export function createPostgresTelegramWorkspaceAuthorityResolver({ persistence, workspaceRegistry, telegramApiClient, resourceAuthorityRegistry, resourceAuthorityAccessContext, projectScope, clock, authorityTtlMs, idFactory, audit } = {}) {
  if (!persistence?.repositories?.identities) throw new TypeError('started persistence with identity repository is required');
  const workspaceStore = workspaceRegistry?.store;
  if (!workspaceStore) throw new TypeError('workspaceRegistry.store is required');
  return createTelegramWorkspaceAuthorityResolver({ workspaceStore, identityLinks: persistence.repositories.identities, telegramApiClient, resourceAuthorityRegistry, resourceAuthorityAccessContext, projectScope, ...(clock ? { clock } : {}), ...(authorityTtlMs ? { authorityTtlMs } : {}), ...(idFactory ? { idFactory } : {}), ...(audit ? { audit } : {}) });
}
