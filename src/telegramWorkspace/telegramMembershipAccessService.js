function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function joinRequest(update) { return update?.chat_join_request ?? null; }
export function createTelegramMembershipAccessService({
  store, workspaceRegistry, botClient, identityResolver, projectScope = 'sg2.1',
  clock = () => new Date(), audit = async () => {}
} = {}) {
  for (const method of ['recordRequest','activateFree','markDeclined']) if (typeof store?.[method] !== 'function') throw new TypeError(`store.${method} is required`);
  if (typeof workspaceRegistry?.resolveTelegramChatId !== 'function') throw new TypeError('workspaceRegistry.resolveTelegramChatId is required');
  for (const method of ['approveChatJoinRequest','declineChatJoinRequest']) if (typeof botClient?.[method] !== 'function') throw new TypeError(`botClient.${method} is required`);
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  const project = required(projectScope, 'projectScope');

  async function handleUpdate(update) {
    const request = joinRequest(update);
    if (!request) return Object.freeze({ handled: false });
    const chatId = required(String(request.chat?.id), 'chatJoinRequest.chat.id');
    const telegramUserId = required(String(request.from?.id), 'chatJoinRequest.from.id');
    const workspace = await workspaceRegistry.resolveTelegramChatId(chatId);
    if (!workspace) {
      await botClient.declineChatJoinRequest({ chatId, userId: telegramUserId });
      return Object.freeze({ handled: true, outcome: 'unknown-workspace-declined' });
    }
    const identity = await identityResolver({
      transport: 'telegram',
      platformFacts: {
        platform: 'telegram',
        platformUserId: telegramUserId,
        platformChatId: chatId,
        profile: {
          displayName: [request.from?.first_name, request.from?.last_name].filter(Boolean).join(' ').trim() || request.from?.username || null,
          firstName: request.from?.first_name ?? null,
          lastName: request.from?.last_name ?? null,
          username: request.from?.username ?? null,
          languageCode: request.from?.language_code ?? null,
          source: 'telegram'
        }
      },
      scopeFacts: { projectId: project, groupId: chatId, threadId: null }
    });
    const globalUserId = required(identity?.identityContext?.globalUserId, 'resolved globalUserId');
    const requestedAt = request.date ? new Date(Number(request.date) * 1000) : clock();
    await store.recordRequest({
      workspaceId: workspace.workspaceId,
      telegramUserId,
      globalUserId,
      requestedAt,
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
  return Object.freeze({ handleUpdate });
}
