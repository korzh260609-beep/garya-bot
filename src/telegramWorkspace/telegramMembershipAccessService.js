function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function joinRequest(update) { return update?.chat_join_request ?? null; }
function membershipChange(update) { return update?.chat_member ?? null; }
const ACTIVE_STATUSES = new Set(['member', 'restricted']);
const PRIVILEGED_STATUSES = new Set(['administrator', 'creator']);
const LEFT_STATUSES = new Set(['left', 'kicked']);

export function createTelegramMembershipAccessService({
  store, workspaceRegistry, botClient, identityResolver, mutationGate, projectScope = 'sg2.1',
  botUserId = null, clock = () => new Date(), audit = async () => {}
} = {}) {
  for (const method of ['recordRequest','activateFree','activateLegacyBaseline','markDeclined','markRemoved','get','getInvite','saveInvite','ensurePolicy','enableStrict']) {
    if (typeof store?.[method] !== 'function') throw new TypeError(`store.${method} is required`);
  }
  if (typeof workspaceRegistry?.resolveTelegramChatId !== 'function') throw new TypeError('workspaceRegistry.resolveTelegramChatId is required');
  if (typeof workspaceRegistry?.listWorkspaces !== 'function') throw new TypeError('workspaceRegistry.listWorkspaces is required');
  for (const method of ['createChatInviteLink','revokeChatInviteLink','approveChatJoinRequest','declineChatJoinRequest','banChatMember','unbanChatMember']) {
    if (typeof botClient?.[method] !== 'function') throw new TypeError(`botClient.${method} is required`);
  }
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof mutationGate?.evaluateDomainMutation !== 'function') throw new TypeError('mutationGate.evaluateDomainMutation is required');
  const project = required(projectScope, 'projectScope');

  async function resolveWorkspaceById(workspaceId) {
    const workspace = (await workspaceRegistry.listWorkspaces({ limit: 100 })).find((item) => item.workspaceId === workspaceId);
    if (!workspace) throw Object.assign(new Error('Telegram workspace not found'), { code: 'membership-workspace-not-found' });
    return workspace;
  }

  async function createJoinRequestLink({ workspaceId, actorGlobalUserId, actorTelegramUserId, authority, traceId, requestId, confirmation, rotate = false }) {
    const id = required(workspaceId, 'workspaceId');
    const existing = await store.getInvite({ workspaceId: id });
    if (existing && !rotate) return Object.freeze({ ...existing, reused: true });
    await mutationGate.evaluateDomainMutation({
      operation: rotate ? 'membership-invite-rotate' : 'membership-invite-create',
      domain: 'membership-invite', recordId: id, workspaceId: id,
      actorGlobalUserId, traceId, requestId, risk: 'medium',
      confirmationRequired: true, authority, confirmation,
      requiredPermission: 'workspace:configure'
    });
    const workspace = await resolveWorkspaceById(id);
    const chatId = required(String(workspace.telegramChatId), 'workspace.telegramChatId');
    const inviteName = 'SG managed membership';
    const created = await botClient.createChatInviteLink({ chatId, name: inviteName, createsJoinRequest: true });
    const inviteLink = required(created?.invite_link ?? created?.inviteLink, 'Telegram invite link');
    const saved = await store.saveInvite({
      workspaceId: id, inviteLink, inviteName,
      createdByGlobalUserId: required(actorGlobalUserId, 'actorGlobalUserId'),
      createdByTelegramUserId: required(String(actorTelegramUserId), 'actorTelegramUserId'),
      at: clock()
    });
    if (existing?.inviteLink && existing.inviteLink !== inviteLink) {
      try { await botClient.revokeChatInviteLink({ chatId, inviteLink: existing.inviteLink }); }
      catch (error) {
        try { await audit({ eventClass: 'telegram_membership_invite', outcome: 'old-link-revoke-failed', workspaceId: id, reason: error?.code ?? null }); } catch {}
      }
    }
    try { await audit({ eventClass: 'telegram_membership_invite', outcome: rotate ? 'rotated' : 'created', workspaceId: id, globalUserId: actorGlobalUserId, telegramUserId: String(actorTelegramUserId) }); } catch {}
    return Object.freeze({ ...saved, reused: false });
  }

  async function enableStrictAccess({ workspaceId, actorGlobalUserId, authority, traceId, requestId, confirmation }) {
    const id = required(workspaceId, 'workspaceId');
    await mutationGate.evaluateDomainMutation({
      operation: 'membership-strict-enable', domain: 'membership-access', recordId: id,
      workspaceId: id, actorGlobalUserId, traceId, requestId, risk: 'high',
      confirmationRequired: true, authority, confirmation, requiredPermission: 'workspace:configure'
    });
    await resolveWorkspaceById(id);
    await store.ensurePolicy({ workspaceId: id, at: clock() });
    const policy = await store.enableStrict({ workspaceId: id, actorGlobalUserId, at: clock() });
    try { await audit({ eventClass: 'telegram_membership_policy', outcome: 'strict-enabled', workspaceId: id, globalUserId: actorGlobalUserId }); } catch {}
    return Object.freeze({ policy, warning: 'Only observed legacy members are baselined; Telegram cannot enumerate all ordinary members.' });
  }

  async function inspectPolicy({ workspaceId }) {
    await resolveWorkspaceById(required(workspaceId, 'workspaceId'));
    return store.ensurePolicy({ workspaceId, at: clock() });
  }

  async function resolveMemberIdentity({ user, chatId, workspaceId, source }) {
    const telegramUserId = required(String(user?.id), 'Telegram member user.id');
    const identity = await identityResolver({
      transport: 'telegram',
      platformFacts: {
        platform: 'telegram', platformUserId: telegramUserId, platformChatId: chatId,
        profile: {
          displayName: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.username || null,
          firstName: user?.first_name ?? null, lastName: user?.last_name ?? null,
          username: user?.username ?? null, languageCode: user?.language_code ?? null, source: 'telegram'
        }
      },
      scopeFacts: { projectId: project, groupId: chatId, threadId: null }
    });
    const globalUserId = required(identity?.identityContext?.globalUserId, 'resolved globalUserId');
    try { await audit({ eventClass: 'telegram_membership_identity', outcome: 'identity-indexed', workspaceId, globalUserId, telegramUserId, source }); } catch {}
    return Object.freeze({ globalUserId, telegramUserId });
  }

  async function handleJoinRequest(request) {
    const chatId = required(String(request.chat?.id), 'chatJoinRequest.chat.id');
    const telegramUserId = required(String(request.from?.id), 'chatJoinRequest.from.id');
    const workspace = await workspaceRegistry.resolveTelegramChatId(chatId);
    if (!workspace) {
      await botClient.declineChatJoinRequest({ chatId, userId: telegramUserId });
      return Object.freeze({ handled: true, outcome: 'unknown-workspace-declined' });
    }
    const { globalUserId } = await resolveMemberIdentity({
      user: request.from, chatId, workspaceId: workspace.workspaceId, source: 'chat-join-request'
    });
    const requestedAt = request.date ? new Date(Number(request.date) * 1000) : clock();
    await store.recordRequest({
      workspaceId: workspace.workspaceId, telegramUserId, globalUserId, requestedAt,
      metadata: { inviteLink: request.invite_link?.invite_link ?? null, userChatId: request.user_chat_id == null ? null : String(request.user_chat_id) }
    });
    try {
      await botClient.approveChatJoinRequest({ chatId, userId: telegramUserId });
      const membership = await store.activateFree({ workspaceId: workspace.workspaceId, telegramUserId, approvedAt: clock() });
      try { await audit({ eventClass: 'telegram_membership_access', outcome: 'approved-free', workspaceId: workspace.workspaceId, globalUserId, telegramUserId }); } catch {}
      return Object.freeze({ handled: true, outcome: 'approved-free', membership });
    } catch (error) {
      await store.markDeclined({ workspaceId: workspace.workspaceId, telegramUserId, at: clock(), reason: error?.code ?? 'telegram-join-approval-failed' });
      try { await audit({ eventClass: 'telegram_membership_access', outcome: 'approval-failed', workspaceId: workspace.workspaceId, globalUserId, telegramUserId, reason: error?.code ?? null }); } catch {}
      throw error;
    }
  }

  async function handleMembershipChange(change) {
    const chatId = required(String(change.chat?.id), 'chatMember.chat.id');
    const user = change.new_chat_member?.user;
    const telegramUserId = required(String(user?.id), 'chatMember.user.id');
    const status = required(change.new_chat_member?.status, 'chatMember.status');
    const workspace = await workspaceRegistry.resolveTelegramChatId(chatId);
    if (!workspace) return Object.freeze({ handled: true, outcome: 'unknown-workspace-ignored' });
    if (botUserId != null && telegramUserId === String(botUserId)) return Object.freeze({ handled: true, outcome: 'bot-membership-ignored' });
    if (PRIVILEGED_STATUSES.has(status)) return Object.freeze({ handled: true, outcome: 'privileged-member-exempt' });
    const membership = await store.get({ workspaceId: workspace.workspaceId, telegramUserId });
    if (LEFT_STATUSES.has(status)) {
      if (membership) await store.markRemoved({ workspaceId: workspace.workspaceId, telegramUserId, at: clock(), reason: 'telegram-member-left' });
      return Object.freeze({ handled: true, outcome: 'membership-left-recorded' });
    }
    if (!ACTIVE_STATUSES.has(status)) return Object.freeze({ handled: true, outcome: 'membership-status-ignored' });
    if (membership && ['requested', 'active'].includes(membership.state)) {
      try { await audit({ eventClass: 'telegram_membership_access', outcome: 'managed-member-confirmed', workspaceId: workspace.workspaceId, telegramUserId }); } catch {}
      return Object.freeze({ handled: true, outcome: 'managed-member-confirmed' });
    }
    const policy = await store.ensurePolicy({ workspaceId: workspace.workspaceId, at: clock() });
    if (policy.enforcementMode === 'baseline') {
      const identity = await resolveMemberIdentity({
        user, chatId, workspaceId: workspace.workspaceId, source: 'chat-member-baseline'
      });
      await store.activateLegacyBaseline({ workspaceId: workspace.workspaceId, telegramUserId,
        globalUserId: identity.globalUserId, observedAt: clock() });
      try { await audit({ eventClass: 'telegram_membership_access', outcome: 'legacy-member-baselined', workspaceId: workspace.workspaceId, telegramUserId }); } catch {}
      return Object.freeze({ handled: true, outcome: 'legacy-member-baselined' });
    }
    await botClient.banChatMember({ chatId, userId: telegramUserId, revokeMessages: false });
    await botClient.unbanChatMember({ chatId, userId: telegramUserId, onlyIfBanned: true });
    try { await audit({ eventClass: 'telegram_membership_access', outcome: 'unauthorized-direct-add-removed', workspaceId: workspace.workspaceId, telegramUserId }); } catch {}
    return Object.freeze({ handled: true, outcome: 'unauthorized-direct-add-removed' });
  }

  async function handleUpdate(update) {
    if (joinRequest(update)) return handleJoinRequest(joinRequest(update));
    if (membershipChange(update)) return handleMembershipChange(membershipChange(update));
    return Object.freeze({ handled: false });
  }
  return Object.freeze({ handleUpdate, createJoinRequestLink, inspectPolicy, enableStrictAccess });
}
