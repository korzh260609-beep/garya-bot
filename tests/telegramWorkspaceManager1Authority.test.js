import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryResourceAuthorityStore, createResourceAuthorityRegistry } from '../src/authority/resourceAuthorityRegistry.js';
import { createTelegramWorkspaceAuthorityResolver } from '../src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js';

function createWorkspaceStore(clock) {
  const workspaces = new Map([
    ['tgw_workspace_a1', { workspaceId: 'tgw_workspace_a1', telegramChatId: '-1001', workspaceType: 'supergroup' }],
    ['tgw_workspace_b2', { workspaceId: 'tgw_workspace_b2', telegramChatId: '-1002', workspaceType: 'channel' }]
  ]);
  const members = new Map();
  const key = (workspaceId, globalUserId) => `${workspaceId}:${globalUserId}`;
  return {
    async getWorkspace(workspaceId) { return workspaces.get(workspaceId) ?? null; },
    async getMember({ workspaceId, globalUserId }) { return members.get(key(workspaceId, globalUserId)) ?? null; },
    async putMember({ workspaceId, globalUserId, role, status = 'active', source = 'sg' }) {
      const row = { workspace_id: workspaceId, global_user_id: globalUserId, role, status, source, updated_at: clock().toISOString() };
      members.set(key(workspaceId, globalUserId), row);
      return row;
    },
    members
  };
}

function fixture() {
  let now = new Date('2026-08-12T10:00:00.000Z');
  const clock = () => new Date(now);
  const advance = (ms) => { now = new Date(now.getTime() + ms); };
  const workspaceStore = createWorkspaceStore(clock);
  const links = new Map([
    ['telegram:10', { platform: 'telegram', platform_user_id: '10', global_user_id: 'usr_creator' }],
    ['telegram:20', { platform: 'telegram', platform_user_id: '20', global_user_id: 'usr_admin' }],
    ['telegram:30', { platform: 'telegram', platform_user_id: '30', global_user_id: 'usr_member' }]
  ]);
  const identityLinks = { async resolve(platform, platformUserId) { return links.get(`${platform}:${platformUserId}`) ?? null; } };
  const statuses = new Map([
    ['-1001:10', 'creator'],
    ['-1001:20', 'administrator'],
    ['-1001:30', 'member'],
    ['-1002:10', 'member'],
    ['-1002:20', 'member'],
    ['-1002:30', 'member']
  ]);
  const telegramCalls = [];
  const telegramApiClient = {
    async call(method, payload) {
      assert.equal(method, 'getChatMember');
      telegramCalls.push({ method, payload: { ...payload } });
      return { user: { id: Number(payload.user_id) }, status: statuses.get(`${payload.chat_id}:${payload.user_id}`) ?? 'member' };
    }
  };
  const resourceStore = createInMemoryResourceAuthorityStore();
  const resourceAuthorityRegistry = createResourceAuthorityRegistry({ store: resourceStore, clock });
  const actor = { globalUserId: 'system:twm-test', grants: ['resource-authority:manage', 'resource-authority:read'] };
  let sequence = 0;
  const resolver = createTelegramWorkspaceAuthorityResolver({
    workspaceStore,
    identityLinks,
    telegramApiClient,
    resourceAuthorityRegistry,
    resourceAuthorityAccessContext: { actor, projectScope: 'sg2.1' },
    projectScope: 'sg2.1',
    clock,
    authorityTtlMs: 60_000,
    idFactory: () => `twa_test_${++sequence}`
  });
  return { resolver, workspaceStore, statuses, telegramCalls, resourceAuthorityRegistry, resourceStore, actor, clock, advance };
}

test('TWM1.4 creator/admin are allowed only for their verified Telegram workspace and member is denied', async () => {
  const f = fixture();

  const creator = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '10', requestedAction: 'workspace:configure', expectedGlobalUserId: 'usr_creator' });
  assert.equal(creator.allowed, true);
  assert.equal(creator.workspaceRole, 'OWNER');
  assert.equal(creator.resourceRelation, 'administers');
  assert.equal(creator.telegramEvidence.status, 'creator');
  assert.equal(Object.hasOwn(creator, 'roles'), false, 'workspace owner must not become an SG-global role');

  const admin = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:configure', expectedGlobalUserId: 'usr_admin' });
  assert.equal(admin.allowed, true);
  assert.equal(admin.workspaceRole, 'ADMIN');
  assert.equal(admin.telegramEvidence.status, 'administrator');

  const member = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '30', requestedAction: 'workspace:configure', expectedGlobalUserId: 'usr_member' });
  assert.equal(member.allowed, false);
  assert.equal(member.reason, 'twm-telegram-resource-authority-denied');

  const crossWorkspace = await f.resolver.verify({ workspaceId: 'tgw_workspace_b2', telegramUserId: '20', requestedAction: 'workspace:configure', expectedGlobalUserId: 'usr_admin' });
  assert.equal(crossWorkspace.allowed, false);
  assert.equal(crossWorkspace.reason, 'twm-telegram-resource-authority-denied');
  assert.equal(f.telegramCalls.at(-1).payload.chat_id, '-1002');
});

test('TWM1.4 sensitive actions reverify live authority and revoke prior Resource Authority when Telegram admin is lost', async () => {
  const f = fixture();
  const initial = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:manage' });
  assert.equal(initial.allowed, true);

  f.statuses.set('-1001:20', 'member');
  const revoked = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:manage' });
  assert.equal(revoked.allowed, false);
  assert.equal(revoked.reason, 'twm-telegram-resource-authority-denied');
  const member = await f.workspaceStore.getMember({ workspaceId: 'tgw_workspace_a1', globalUserId: 'usr_admin' });
  assert.equal(member.status, 'revoked');

  const authority = await f.resourceAuthorityRegistry.checkAuthority({ actorGlobalUserId: 'usr_admin', resourceId: 'tgw_workspace_a1', projectScope: 'sg2.1', relation: 'administers', includeHierarchy: false });
  assert.equal(authority.allowed, false);
  const history = await f.resourceAuthorityRegistry.listAuthorities({ projectScope: 'sg2.1', actorGlobalUserId: 'usr_admin', resourceId: 'tgw_workspace_a1', includeRevoked: true, actor: f.actor });
  assert.ok(history.some((item) => item.state === 'revoked'));
});

test('TWM1.4 cached low-risk evidence expires and stale authority is reverified fail-closed', async () => {
  const f = fixture();
  const initial = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:view' });
  assert.equal(initial.allowed, true);
  assert.equal(f.telegramCalls.length, 1);

  f.statuses.set('-1001:20', 'member');
  f.advance(30_000);
  const cached = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:view' });
  assert.equal(cached.allowed, true);
  assert.equal(cached.reason, 'twm-workspace-authority-cached');
  assert.equal(f.telegramCalls.length, 1);

  f.advance(31_000);
  const stale = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:view' });
  assert.equal(stale.allowed, false);
  assert.equal(stale.reason, 'twm-telegram-resource-authority-denied');
  assert.equal(f.telegramCalls.length, 2);
});

test('TWM1.4 SG workspace grant can be stricter than Telegram admin and identity-link mismatch fails before Telegram call', async () => {
  const f = fixture();
  await f.workspaceStore.putMember({ workspaceId: 'tgw_workspace_a1', globalUserId: 'usr_admin', role: 'VIEWER', status: 'active', source: 'sg' });

  const configure = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:configure' });
  assert.equal(configure.allowed, false);
  assert.equal(configure.reason, 'twm-workspace-role-denied');
  assert.equal(configure.workspaceRole, 'VIEWER');

  const before = f.telegramCalls.length;
  const mismatch = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:view', expectedGlobalUserId: 'usr_someone_else' });
  assert.equal(mismatch.allowed, false);
  assert.equal(mismatch.reason, 'twm-telegram-identity-link-mismatch');
  assert.equal(f.telegramCalls.length, before);
});

test('TWM1.4 Telegram verification errors deny sensitive action without trusting stale grant', async () => {
  const f = fixture();
  const initial = await f.resolver.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:manage' });
  assert.equal(initial.allowed, true);
  const failing = createTelegramWorkspaceAuthorityResolver({
    workspaceStore: f.workspaceStore,
    identityLinks: { resolve: async () => ({ global_user_id: 'usr_admin' }) },
    telegramApiClient: { call: async () => { const error = new Error('offline'); error.code = 'telegram-timeout'; throw error; } },
    resourceAuthorityRegistry: f.resourceAuthorityRegistry,
    resourceAuthorityAccessContext: { actor: f.actor, projectScope: 'sg2.1' },
    projectScope: 'sg2.1',
    clock: f.clock,
    authorityTtlMs: 60_000
  });
  const decision = await failing.verify({ workspaceId: 'tgw_workspace_a1', telegramUserId: '20', requestedAction: 'workspace:manage' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'telegram-timeout');
});
