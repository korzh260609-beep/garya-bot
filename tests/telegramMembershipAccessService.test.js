import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramMembershipAccessService } from '../src/telegramWorkspace/telegramMembershipAccessService.js';

function fixture({ workspace = { workspaceId: 'workspace-1', telegramChatId: '-100123' }, approvalError = null, membership = null, invite = null, enforcementMode = 'baseline' } = {}) {
  const calls = [];
  const store = {
    async recordRequest(value) { calls.push(['record', value]); return { state: 'requested' }; },
    async activateFree(value) { calls.push(['activate', value]); return { state: 'active', telegramUserId: value.telegramUserId }; },
    async markDeclined(value) { calls.push(['mark-declined', value]); return { state: 'declined' }; },
    async markRemoved(value) { calls.push(['mark-removed', value]); return { state: 'removed' }; },
    async activateLegacyBaseline(value) { calls.push(['baseline-member', value]); return { state: 'active', metadata: { legacyBaseline: true } }; },
    async get(value) { calls.push(['get', value]); return membership; },
    async getInvite(value) { calls.push(['get-invite', value]); return invite; },
    async saveInvite(value) { calls.push(['save-invite', value]); return { ...value, version: invite ? 2 : 1 }; },
    async ensurePolicy(value) { calls.push(['ensure-policy', value]); return { workspaceId: value.workspaceId, enforcementMode }; },
    async enableStrict(value) { calls.push(['enable-strict', value]); return { workspaceId: value.workspaceId, enforcementMode: 'strict' }; }
  };
  const botClient = {
    async approveChatJoinRequest(value) { calls.push(['approve', value]); if (approvalError) throw approvalError; },
    async declineChatJoinRequest(value) { calls.push(['decline', value]); },
    async createChatInviteLink(value) { calls.push(['create-invite', value]); return { invite_link: 'https://t.me/+managed' }; },
    async revokeChatInviteLink(value) { calls.push(['revoke-invite', value]); },
    async banChatMember(value) { calls.push(['ban', value]); },
    async unbanChatMember(value) { calls.push(['unban', value]); }
  };
  const service = createTelegramMembershipAccessService({
    store,
    workspaceRegistry: {
      async resolveTelegramChatId(chatId) { calls.push(['resolve', chatId]); return workspace; },
      async listWorkspaces() { calls.push(['list']); return workspace ? [workspace] : []; }
    },
    botClient,
    identityResolver: async ({ platformFacts }) => ({ identityContext: { globalUserId: `telegram:${platformFacts.platformUserId}` } }),
    mutationGate: { async evaluateDomainMutation(value) { calls.push(['gate', value]); return { outcome: 'allow' }; } },
    botUserId: '999',
    clock: () => new Date('2026-08-18T12:00:00.000Z')
  });
  return { service, calls };
}
function request(userId = 77) {
  return { update_id: 1000 + userId, chat_join_request: { chat: { id: -100123, type: 'supergroup' }, from: { id: userId, first_name: 'Member', username: `member${userId}` }, date: 1787050800, user_chat_id: userId } };
}
function member(status, userId = 77) {
  return { update_id: 2000 + userId, chat_member: { chat: { id: -100123, type: 'supergroup' }, from: { id: 1 }, new_chat_member: { status, user: { id: userId } } } };
}

test('free join request is persisted, approved and activated for the requesting user', async () => {
  const { service, calls } = fixture();
  const result = await service.handleUpdate(request(77));
  assert.equal(result.outcome, 'approved-free');
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'record', 'approve', 'activate']);
  assert.equal(calls[1][1].globalUserId, 'telegram:77');
});

test('requests for an unregistered Telegram workspace fail closed', async () => {
  const { service, calls } = fixture({ workspace: null });
  assert.equal((await service.handleUpdate(request(88))).outcome, 'unknown-workspace-declined');
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'decline']);
});

test('Telegram approval failure records declined state and never activates access', async () => {
  const failure = Object.assign(new Error('forbidden'), { code: 'telegram-forbidden' });
  const { service, calls } = fixture({ approvalError: failure });
  await assert.rejects(() => service.handleUpdate(request(99)), failure);
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'record', 'approve', 'mark-declined']);
});

test('managed join link is created only after Action Gate approval', async () => {
  const { service, calls } = fixture();
  const result = await service.createJoinRequestLink({
    workspaceId: 'workspace-1', actorGlobalUserId: 'telegram:1', actorTelegramUserId: '1',
    authority: { allowed: true, workspaceRole: 'admin' }, traceId: 'trace-1', requestId: 'request-1',
    confirmation: { confirmed: true, requestId: 'request-1' }
  });
  assert.equal(result.inviteLink, 'https://t.me/+managed');
  assert.deepEqual(calls.map(([name]) => name), ['get-invite', 'gate', 'list', 'create-invite', 'save-invite']);
  assert.equal(calls[3][1].createsJoinRequest, true);
});

test('existing managed link is reused without another Telegram mutation', async () => {
  const existing = { workspaceId: 'workspace-1', inviteLink: 'https://t.me/+existing', version: 1 };
  const { service, calls } = fixture({ invite: existing });
  const result = await service.createJoinRequestLink({ workspaceId: 'workspace-1', actorGlobalUserId: 'telegram:1', actorTelegramUserId: '1' });
  assert.equal(result.reused, true);
  assert.deepEqual(calls.map(([name]) => name), ['get-invite']);
});

test('rotating a link persists the replacement before revoking the old link', async () => {
  const existing = { workspaceId: 'workspace-1', inviteLink: 'https://t.me/+old', version: 1 };
  const { service, calls } = fixture({ invite: existing });
  await service.createJoinRequestLink({
    workspaceId: 'workspace-1', actorGlobalUserId: 'telegram:1', actorTelegramUserId: '1',
    authority: { allowed: true }, traceId: 'trace-2', requestId: 'request-2',
    confirmation: { confirmed: true, requestId: 'request-2' }, rotate: true
  });
  assert.deepEqual(calls.map(([name]) => name), ['get-invite', 'gate', 'list', 'create-invite', 'save-invite', 'revoke-invite']);
});

test('membership lifecycle records leave and safely baselines an observed legacy member', async () => {
  const active = { state: 'active' };
  const left = fixture({ membership: active });
  assert.equal((await left.service.handleUpdate(member('left'))).outcome, 'membership-left-recorded');
  assert.deepEqual(left.calls.map(([name]) => name), ['resolve', 'get', 'mark-removed']);

  const unmanaged = fixture({ membership: null });
  assert.equal((await unmanaged.service.handleUpdate(member('member'))).outcome, 'legacy-member-baselined');
  assert.deepEqual(unmanaged.calls.map(([name]) => name), ['resolve', 'get', 'ensure-policy', 'baseline-member']);
});

test('strict mode removes an unknown direct add but does not permanently ban rejoin', async () => {
  const { service, calls } = fixture({ membership: null, enforcementMode: 'strict' });
  assert.equal((await service.handleUpdate(member('member', 81))).outcome, 'unauthorized-direct-add-removed');
  assert.deepEqual(calls.map(([name]) => name), ['resolve', 'get', 'ensure-policy', 'ban', 'unban']);
  assert.equal(calls.find(([name]) => name === 'ban')[1].revokeMessages, false);
});

test('strict mode activation is a confirmed high-risk Action Gate mutation', async () => {
  const { service, calls } = fixture();
  const result = await service.enableStrictAccess({
    workspaceId: 'workspace-1', actorGlobalUserId: 'telegram:1', authority: { allowed: true },
    traceId: 'trace-strict', requestId: 'request-strict',
    confirmation: { confirmed: true, requestId: 'request-strict' }
  });
  assert.equal(result.policy.enforcementMode, 'strict');
  assert.deepEqual(calls.map(([name]) => name), ['gate', 'list', 'ensure-policy', 'enable-strict']);
  assert.equal(calls[0][1].risk, 'high');
  assert.equal(calls[0][1].confirmationRequired, true);
});

test('administrators are exempt and unrelated updates are not consumed', async () => {
  const { service, calls } = fixture();
  assert.equal((await service.handleUpdate(member('administrator'))).outcome, 'privileged-member-exempt');
  assert.deepEqual(await service.handleUpdate({ update_id: 1, message: {} }), { handled: false });
  assert.deepEqual(calls.map(([name]) => name), ['resolve']);
});
