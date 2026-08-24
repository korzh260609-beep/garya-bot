import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceAuthorityResolver } from '../src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js';

function resolverFor(status = 'member') {
  const workspace = { workspaceId: 'workspace-1', telegramChatId: '-1001', workspaceType: 'supergroup' };
  const members = new Map();
  const registry = {
    async describeResource() { return null; },
    async registerResource() { return {}; },
    async setResourceVerification() { return {}; },
    async listAuthorities() { return []; },
    async grantAuthority() { return {}; },
    async revokeAuthority() { return {}; },
    async checkAuthority() { return { allowed: false }; }
  };
  return createTelegramWorkspaceAuthorityResolver({
    workspaceStore: {
      async getWorkspace(id) { return id === workspace.workspaceId ? workspace : null; },
      async getMember({ workspaceId, globalUserId }) { return members.get(`${workspaceId}:${globalUserId}`) ?? null; },
      async putMember(row) { members.set(`${row.workspaceId}:${row.globalUserId}`, row); return row; }
    },
    identityLinks: { async resolve(platform, userId) { return platform === 'telegram' && userId === '303' ? { globalUserId: 'user:303' } : null; } },
    telegramApiClient: { async getChatMember() { return { status }; } },
    resourceAuthorityRegistry: registry,
    resourceAuthorityAccessContext: { actor: { globalUserId: 'system' } },
    projectScope: 'sg2.1',
    clock: () => new Date('2026-08-18T12:00:00.000Z')
  });
}

test('ordinary Telegram member may participate in a test without receiving workspace read or mutation authority', async () => {
  const resolver = resolverFor('member');
  const participant = await resolver.verify({
    workspaceId: 'workspace-1',
    telegramUserId: '303',
    expectedGlobalUserId: 'user:303',
    requestedAction: 'workspace:participate',
    forceFresh: true
  });
  assert.equal(participant.allowed, true);
  assert.equal(participant.workspaceRole, 'PARTICIPANT');
  assert.equal(participant.resourceRelation, 'participates');
  assert.equal(participant.resourceAuthority, null);

  const publish = await resolver.verify({
    workspaceId: 'workspace-1',
    telegramUserId: '303',
    expectedGlobalUserId: 'user:303',
    requestedAction: 'workspace:publish',
    forceFresh: true
  });
  assert.equal(publish.allowed, false);
  assert.equal(publish.reason, 'twm-telegram-resource-authority-denied');
});

test('former or non-member Telegram user cannot use the participation boundary', async () => {
  const resolver = resolverFor('left');
  const decision = await resolver.verify({
    workspaceId: 'workspace-1',
    telegramUserId: '303',
    expectedGlobalUserId: 'user:303',
    requestedAction: 'workspace:participate',
    forceFresh: true
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'twm-telegram-participation-denied');
});
